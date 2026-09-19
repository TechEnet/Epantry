import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions =
  Object.freeze({
    timestamps:
      true,

    strict:
      true,

    minimize:
      false,
  })

export const PRODUCT_IDENTITY_SCHEMES =
  Object.freeze([
    'gtin',
    'ean',
    'upc',
    'internal',
  ])

export const PRODUCT_IDENTITY_STATUSES =
  Object.freeze([
    'active',
    'inactive',
    'disputed',
  ])

export const BARCODE_OBSERVATION_SOURCES =
  Object.freeze([
    'camera',
    'manual',
    'uploaded_image',
  ])

export const BARCODE_RESOLUTION_STATES =
  Object.freeze([
    'verified_current',
    'verified_historical',
    'provisional_external',
    'unresolved',
    'unsupported',
  ])

export const PRODUCT_IDENTITY_MATCH_METHODS =
  Object.freeze([
    'product_identity',
    'product_version_gtin',
    'external_evidence',
    'ai_candidate',
  ])

export const PRODUCT_IDENTITY_MATCH_STATUSES =
  Object.freeze([
    'accepted',
    'pending_review',
    'rejected',
  ])

export const PRODUCT_EVIDENCE_PURPOSES =
  Object.freeze([
    'front_pack',
    'back_pack',
    'ingredient_panel',
    'nutrition_panel',
    'allergen_statement',
    'barcode',
    'certification_mark',
    'side_panel',
    'other',
  ])

export const PRODUCT_EVIDENCE_STATUSES =
  Object.freeze([
    'active',
    'redacted',
    'deleted',
  ])

export const COMMUNITY_PRODUCT_DRAFT_ORIGINS =
  Object.freeze([
    'customer_scan',
    'host_npi',
    'admin_npi',
    'open_food_facts',
  ])

export const COMMUNITY_PRODUCT_LISTING_TYPES =
  Object.freeze([
    'packaged',
    'vegetable',
    'fruit',
  ])

export const COMMUNITY_PRODUCT_DRAFT_STATUSES =
  Object.freeze([
    'provisional',
    'extracting',
    'ready_for_review',
    'needs_more_evidence',
    'approved_for_catalog',
    'rejected',
  ])

export const COMMUNITY_PRODUCT_VERIFICATION_STATES =
  Object.freeze([
    'unverified',
    'provisional',
    'reviewed',
  ])

export const NPI_JOB_INITIATOR_TYPES =
  Object.freeze([
    'customer',
    'host',
    'admin',
  ])

export const NPI_JOB_STATUSES =
  Object.freeze([
    'queued',
    'extracting',
    'ready_for_review',
    'needs_more_evidence',
    'approved_for_catalog',
    'rejected',
    'failed',
  ])

export const LABEL_EXTRACTION_STATUSES =
  Object.freeze([
    'succeeded',
    'failed',
  ])

export const NPI_FIELD_REVIEW_STATES =
  Object.freeze([
    'pending_review',
    'accepted',
    'rejected',
    'needs_evidence',
  ])

export const NPI_REVIEW_DECISIONS =
  Object.freeze([
    'approve_for_catalog',
    'request_more_evidence',
    'reject',
  ])

/*
|--------------------------------------------------------------------------
| Product Identity
|--------------------------------------------------------------------------
|
| Canonical identifier -> existing Pack/ProductVersion.
| ProductVersion history is never duplicated here.
|
*/

const productIdentitySchema =
  new Schema(
    {
      scheme: {
        type:
          String,

        enum:
          PRODUCT_IDENTITY_SCHEMES,

        required:
          true,

        index:
          true,
      },

      value: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          180,

        index:
          true,
      },

      market: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          10,

        default:
          'IN',

        index:
          true,
      },

      packId: {
        type:
          objectId,

        ref:
          'Pack',

        required:
          true,

        index:
          true,
      },

      productVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,

        index:
          true,
      },

      validFrom: {
        type:
          Date,

        default:
          null,
      },

      validTo: {
        type:
          Date,

        default:
          null,
      },

      status: {
        type:
          String,

        enum:
          PRODUCT_IDENTITY_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      provenance: {
        sourceType: {
          type:
            String,

          trim:
            true,

          maxlength:
            80,

          default:
            'canonical_product_version',
        },

        sourceReference: {
          type:
            String,

          trim:
            true,

          maxlength:
            500,

          default:
            '',
        },
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },
    },
    {
      ...baseOptions,

      collection:
        'productIdentities',
    },
  )

productIdentitySchema.index({
  scheme:
    1,

  value:
    1,

  market:
    1,

  status:
    1,

  validFrom:
    -1,

  validTo:
    -1,
})

productIdentitySchema.index({
  packId:
    1,

  productVersionId:
    1,
})

/*
|--------------------------------------------------------------------------
| Barcode Observation
|--------------------------------------------------------------------------
|
| Decoder output is evidence, not canonical product truth.
|
*/

const barcodeObservationSchema =
  new Schema(
    {
      code: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          180,
      },

      normalizedCode: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          180,

        index:
          true,
      },

      decodedFormat: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          80,

        default:
          'UNKNOWN',
      },

      source: {
        type:
          String,

        enum:
          BARCODE_OBSERVATION_SOURCES,

        required:
          true,

        default:
          'camera',
      },

      market: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          10,

        default:
          'IN',
      },

      resolutionState: {
        type:
          String,

        enum:
          BARCODE_RESOLUTION_STATES,

        required:
          true,

        index:
          true,
      },

      identityId: {
        type:
          objectId,

        ref:
          'ProductIdentity',

        default:
          null,
      },

      canonicalProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,

        index:
          true,
      },

      canonicalPackId: {
        type:
          objectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      provisionalDraftId: {
        type:
          objectId,

        ref:
          'CommunityProductDraft',

        default:
          null,

        index:
          true,
      },

      matchMethod: {
        type:
          String,

        enum:
          PRODUCT_IDENTITY_MATCH_METHODS,

        default:
          null,
      },

      confidence: {
        type:
          Number,

        min:
          0,

        max:
          1,

        default:
          null,
      },

      observedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      requestId: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      observedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,

        index:
          true,
      },
    },
    {
      ...baseOptions,

      collection:
        'barcodeObservations',
    },
  )

barcodeObservationSchema.index({
  observedByUserId:
    1,

  observedAt:
    -1,
})

barcodeObservationSchema.index({
  normalizedCode:
    1,

  observedAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Product Identity Match
|--------------------------------------------------------------------------
*/

const productIdentityMatchSchema =
  new Schema(
    {
      barcodeObservationId: {
        type:
          objectId,

        ref:
          'BarcodeObservation',

        required:
          true,

        index:
          true,
      },

      productIdentityId: {
        type:
          objectId,

        ref:
          'ProductIdentity',

        default:
          null,
      },

      candidateProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,

        index:
          true,
      },

      candidatePackId: {
        type:
          objectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      provisionalDraftId: {
        type:
          objectId,

        ref:
          'CommunityProductDraft',

        default:
          null,

        index:
          true,
      },

      method: {
        type:
          String,

        enum:
          PRODUCT_IDENTITY_MATCH_METHODS,

        required:
          true,
      },

      score: {
        type:
          Number,

        min:
          0,

        max:
          1,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          PRODUCT_IDENTITY_MATCH_STATUSES,

        required:
          true,

        default:
          'pending_review',

        index:
          true,
      },

      reasonCodes: {
        type: [
          String,
        ],

        default: [],
      },

      decidedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      decidedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      ...baseOptions,

      collection:
        'productIdentityMatches',
    },
  )

productIdentityMatchSchema.pre(
  'validate',
  function validateIdentityMatchTarget(
    next,
  ) {
    if (
      !this
        .candidateProductVersionId &&
      !this
        .provisionalDraftId
    ) {
      this.invalidate(
        'candidateProductVersionId',
        'A canonical ProductVersion or provisional product draft target is required.',
      )
    }

    next()
  },
)

productIdentityMatchSchema.index({
  barcodeObservationId:
    1,

  candidateProductVersionId:
    1,

  method:
    1,
})

productIdentityMatchSchema.index({
  barcodeObservationId:
    1,

  provisionalDraftId:
    1,

  method:
    1,
})

/*
|--------------------------------------------------------------------------
| Image Evidence
|--------------------------------------------------------------------------
|
| Binary data stays in Cloudinary.
| MongoDB stores only verified provider metadata.
|
*/

const imageEvidenceSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        default:
          null,

        index:
          true,
      },

      purpose: {
        type:
          String,

        enum:
          PRODUCT_EVIDENCE_PURPOSES,

        required:
          true,

        index:
          true,
      },

      provider: {
        type:
          String,

        enum: [
          'cloudinary',
        ],

        required:
          true,

        default:
          'cloudinary',
      },

      providerAssetId: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      publicId: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          500,

        index:
          true,
      },

      version: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      format: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          20,
      },

      mimeType: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          80,
      },

      bytes: {
        type:
          Number,

        required:
          true,

        min:
          1,

        max:
          8 *
          1024 *
          1024,
      },

      width: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      height: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      deliveryType: {
        type:
          String,

        enum: [
          'authenticated',
        ],

        required:
          true,

        default:
          'authenticated',
      },

      uploadSignatureVerified: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      sha256: {
        type:
          String,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          128,

        default:
          '',
      },

      status: {
        type:
          String,

        enum:
          PRODUCT_EVIDENCE_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      capturedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      retentionUntil: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },
    },
    {
      ...baseOptions,

      collection:
        'imageEvidence',
    },
  )

imageEvidenceSchema.index(
  {
    provider:
      1,

    publicId:
      1,

    version:
      1,
  },
  {
    unique:
      true,
  },
)

imageEvidenceSchema.index({
  ownerUserId:
    1,

  createdAt:
    -1,
})

imageEvidenceSchema.index({
  organizationId:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Community / Host Provisional Product Draft
|--------------------------------------------------------------------------
|
| Provisional staging only.
| This collection is NEVER canonical ProductVersion truth.
|
*/

const communityProductDraftSchema =
  new Schema(
    {
      origin: {
        type:
          String,

        enum:
          COMMUNITY_PRODUCT_DRAFT_ORIGINS,

        required:
          true,

        index:
          true,
      },

      listingType: {
        type:
          String,

        enum:
          COMMUNITY_PRODUCT_LISTING_TYPES,

        required:
          true,

        default:
          'packaged',

        index:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        default:
          null,

        index:
          true,
      },

      canonicalBrandId: {
        type:
          objectId,

        ref:
          'Brand',

        default:
          null,

        index:
          true,
      },

      authorityGrantId: {
        type:
          objectId,

        ref:
          'BrandAuthorityGrant',

        default:
          null,
      },

      brandAuthorityVerified: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      market: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          10,

        default:
          'IN',

        index:
          true,
      },

      barcode: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          '',

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          COMMUNITY_PRODUCT_DRAFT_STATUSES,

        required:
          true,

        default:
          'provisional',

        index:
          true,
      },

      verificationStatus: {
        type:
          String,

        enum:
          COMMUNITY_PRODUCT_VERIFICATION_STATES,

        required:
          true,

        default:
          'unverified',
      },

      candidateFields: {
        type:
          Schema.Types.Mixed,

        default: {},
      },

      sourceEvidenceIds: [
        {
          type:
            objectId,

          ref:
            'ImageEvidence',
        },
      ],

      latestExtractionId: {
        type:
          objectId,

        ref:
          'LabelExtraction',

        default:
          null,
      },

      duplicateCandidateProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,

        index:
          true,
      },

      externalEvidence: {
        type:
          Schema.Types.Mixed,

        default:
          null,
      },

      safetyReviewRequired: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      readyForCatalog: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      catalogPackId: {
        type:
          objectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      catalogProductVersionId: {
        type:
          objectId,

        ref:
          'ProductVersion',

        default:
          null,

        index:
          true,
      },

      catalogHandoffAt: {
        type:
          Date,

        default:
          null,
      },

      catalogHandoffByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      bulkBatchId: {
        type:
          objectId,

        ref:
          'NpiBulkBatch',

        default:
          null,

        index:
          true,
      },

      bulkRowNumber: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      merchantSku: {
        type:
          String,

        trim:
          true,

        maxlength:
          220,

        default:
          '',

        index:
          true,
      },

      commercialDraft: {
        type:
          Schema.Types.Mixed,

        default:
          null,
      },

      commercializationStatus: {
        type:
          String,

        enum: [
          'not_requested',
          'pending',
          'processing',
          'prepared',
          'live',
          'action_required',
          'skipped',
        ],

        default:
          'not_requested',

        index:
          true,
      },

      commercializationError: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },

      commercializationAttemptedAt: {
        type:
          Date,

        default:
          null,
      },

      commercializedAt: {
        type:
          Date,

        default:
          null,
      },

      catalogPublishedAt: {
        type:
          Date,

        default:
          null,
      },

      marketplaceOfferId: {
        type:
          objectId,

        ref:
          'HostOffer',

        default:
          null,
      },

      marketplacePriceRuleId: {
        type:
          objectId,

        ref:
          'PriceRule',

        default:
          null,
      },

      marketplaceInventoryNodeId: {
        type:
          objectId,

        ref:
          'InventoryNode',

        default:
          null,
      },

      marketplaceInventorySnapshotId: {
        type:
          objectId,

        ref:
          'InventorySnapshot',

        default:
          null,
      },

      marketplaceServiceAreaId: {
        type:
          objectId,

        ref:
          'ServiceArea',

        default:
          null,
      },

      reviewSummary: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },

      reviewedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      ...baseOptions,

      collection:
        'communityProductDrafts',
    },
  )

communityProductDraftSchema.index({
  status:
    1,

  safetyReviewRequired:
    1,

  createdAt:
    1,
})

communityProductDraftSchema.index({
  createdByUserId:
    1,

  createdAt:
    -1,
})

communityProductDraftSchema.index({
  organizationId:
    1,

  createdAt:
    -1,
})

communityProductDraftSchema.index({
  bulkBatchId:
    1,

  bulkRowNumber:
    1,
})

communityProductDraftSchema.index({
  organizationId:
    1,

  merchantSku:
    1,
})

/*
|--------------------------------------------------------------------------
| Host Bulk NPI Batch
|--------------------------------------------------------------------------
*/

const npiBulkBatchSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      listingType: {
        type:
          String,

        enum:
          COMMUNITY_PRODUCT_LISTING_TYPES,

        required:
          true,

        index:
          true,
      },

      market: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        maxlength:
          10,

        default:
          'IN',
      },

      sourceFileName: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      status: {
        type:
          String,

        enum: [
          'submitted',
          'needs_attention',
          'in_review',
          'completed',
        ],

        required:
          true,

        default:
          'submitted',

        index:
          true,
      },

      sourceRowCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      submittedRowCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      reviewReadyCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      issueCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      duplicateCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      draftIds: [
        {
          type:
            objectId,

          ref:
            'CommunityProductDraft',
        },
      ],

      validationIssues: [
        {
          rowNumber: {
            type:
              Number,

            min:
              1,

            required:
              true,
          },

          merchantSku: {
            type:
              String,

            trim:
              true,

            maxlength:
              220,

            default:
              '',
          },

          productName: {
            type:
              String,

            trim:
              true,

            maxlength:
              350,

            default:
              '',
          },

          issues: [
            {
              type:
                String,

              trim:
                true,

              maxlength:
                500,
            },
          ],
        },
      ],

      submittedAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    {
      ...baseOptions,

      collection:
        'npiBulkBatches',
    },
  )

npiBulkBatchSchema.index({
  organizationId:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| NPI Extraction Job
|--------------------------------------------------------------------------
*/

const npiJobSchema =
  new Schema(
    {
      draftId: {
        type:
          objectId,

        ref:
          'CommunityProductDraft',

        required:
          true,

        index:
          true,
      },

      initiatorType: {
        type:
          String,

        enum:
          NPI_JOB_INITIATOR_TYPES,

        required:
          true,

        index:
          true,
      },

      requestedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        default:
          null,

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          NPI_JOB_STATUSES,

        required:
          true,

        default:
          'queued',

        index:
          true,
      },

      providerTask: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        default:
          'openrouter_label_extraction',
      },

      startedAt: {
        type:
          Date,

        default:
          null,
      },

      completedAt: {
        type:
          Date,

        default:
          null,
      },

      failureCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          '',
      },
    },
    {
      ...baseOptions,

      collection:
        'npiJobs',
    },
  )

npiJobSchema.index({
  status:
    1,

  createdAt:
    1,
})

/*
|--------------------------------------------------------------------------
| Label Extraction
|--------------------------------------------------------------------------
*/

const labelExtractionSchema =
  new Schema(
    {
      npiJobId: {
        type:
          objectId,

        ref:
          'NPIJob',

        required:
          true,

        index:
          true,
      },

      draftId: {
        type:
          objectId,

        ref:
          'CommunityProductDraft',

        required:
          true,

        index:
          true,
      },

      imageEvidenceIds: [
        {
          type:
            objectId,

          ref:
            'ImageEvidence',
        },
      ],

      provider: {
        type:
          String,

        enum: [
          'openrouter',
        ],

        required:
          true,

        default:
          'openrouter',
      },

      modelId: {
        type:
          String,

        trim:
          true,

        maxlength:
          250,

        default:
          '',
      },

      parserVersion: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        default:
          'm14-label-v1',
      },

      status: {
        type:
          String,

        enum:
          LABEL_EXTRACTION_STATUSES,

        required:
          true,

        index:
          true,
      },

      candidateFields: {
        type:
          Schema.Types.Mixed,

        default: {},
      },

      confidenceSummary: {
        type:
          Schema.Types.Mixed,

        default: {},
      },

      safetyFlags: {
        type: [
          String,
        ],

        default: [],
      },

      normalizedLabelText: {
        type:
          String,

        trim:
          true,

        maxlength:
          12000,

        default:
          '',
      },

      failureCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          '',
      },
    },
    {
      ...baseOptions,

      collection:
        'labelExtractions',
    },
  )

labelExtractionSchema.index({
  draftId:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Human NPI Review
|--------------------------------------------------------------------------
*/

const reviewFieldDecisionSchema =
  new Schema(
    {
      fieldPath: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          200,
      },

      decision: {
        type:
          String,

        enum:
          NPI_FIELD_REVIEW_STATES,

        required:
          true,
      },

      correctedValue: {
        type:
          Schema.Types.Mixed,

        default:
          null,
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          1000,

        default:
          '',
      },
    },
    {
      _id:
        false,
    },
  )

const productNpiReviewDecisionSchema =
  new Schema(
    {
      draftId: {
        type:
          objectId,

        ref:
          'CommunityProductDraft',

        required:
          true,

        index:
          true,
      },

      reviewerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      decision: {
        type:
          String,

        enum:
          NPI_REVIEW_DECISIONS,

        required:
          true,

        index:
          true,
      },

      fieldDecisions: {
        type: [
          reviewFieldDecisionSchema,
        ],

        default: [],
      },

      reason: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          4000,
      },
    },
    {
      ...baseOptions,

      collection:
        'productNpiReviewDecisions',
    },
  )

productNpiReviewDecisionSchema.index({
  draftId:
    1,

  createdAt:
    -1,
})

export const ProductIdentity =
  mongoose.models
    .ProductIdentity ||
  mongoose.model(
    'ProductIdentity',
    productIdentitySchema,
  )

export const BarcodeObservation =
  mongoose.models
    .BarcodeObservation ||
  mongoose.model(
    'BarcodeObservation',
    barcodeObservationSchema,
  )

export const ProductIdentityMatch =
  mongoose.models
    .ProductIdentityMatch ||
  mongoose.model(
    'ProductIdentityMatch',
    productIdentityMatchSchema,
  )

export const ImageEvidence =
  mongoose.models
    .ImageEvidence ||
  mongoose.model(
    'ImageEvidence',
    imageEvidenceSchema,
  )

export const CommunityProductDraft =
  mongoose.models
    .CommunityProductDraft ||
  mongoose.model(
    'CommunityProductDraft',
    communityProductDraftSchema,
  )

export const NpiBulkBatch =
  mongoose.models
    .NpiBulkBatch ||
  mongoose.model(
    'NpiBulkBatch',
    npiBulkBatchSchema,
  )

export const NPIJob =
  mongoose.models
    .NPIJob ||
  mongoose.model(
    'NPIJob',
    npiJobSchema,
  )

export const LabelExtraction =
  mongoose.models
    .LabelExtraction ||
  mongoose.model(
    'LabelExtraction',
    labelExtractionSchema,
  )

export const ProductNpiReviewDecision =
  mongoose.models
    .ProductNpiReviewDecision ||
  mongoose.model(
    'ProductNpiReviewDecision',
    productNpiReviewDecisionSchema,
  )

export const universalProductModels =
  Object.freeze({
    ProductIdentity,
    BarcodeObservation,
    ProductIdentityMatch,
    ImageEvidence,
    CommunityProductDraft,
    NpiBulkBatch,
    NPIJob,
    LabelExtraction,
    ProductNpiReviewDecision,
  })