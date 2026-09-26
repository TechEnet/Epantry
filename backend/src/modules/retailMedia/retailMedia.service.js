import crypto from 'crypto'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  AdminFeatureFlag,
} from '../adminGovernance/adminGovernance.models.js'

import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayPublicConfig,
  verifyRazorpayCheckoutSignature,
} from '../commerce/commerce.payment.provider.js'

import {
  HostCampaignBrief,
} from '../hostOperations/hostOperations.models.js'

import {
  assertHostOperationsPermission,
  resolveHostOperationsContext,
} from '../hostOperations/hostOperations.service.js'

import {
  AdDecisionLog,
  Campaign,
} from './retailMedia.models.js'

export const M21_RETAIL_MEDIA_FEATURE_FLAG =
  'm21.retail_media'

export const RETAIL_MEDIA_PLACEMENT_PRICING_MINOR = Object.freeze({
  home: 250000,
  search: 200000,
  recipe: 120000,
  product_detail: 150000,
  pantry_replenishment: 100000,
  basket_compare: 180000,
  post_purchase: 80000,
})

const RETAIL_MEDIA_PAYMENT_CURRENCY = 'INR'
const RETAIL_MEDIA_PAYMENT_RECIPIENT =
  'EPANTRY platform (Super Admin controlled)'

const LEGACY_PARALLEL_ARRAY_CAMPAIGN_INDEX_KEYS = Object.freeze([
  'status',
  'placements',
  'marketCodes',
  'startsAt',
  'endsAt',
])

let campaignIndexReconciliationPromise = null

function isLegacyParallelArrayCampaignIndex(index) {
  const keys = Object.keys(index?.key || {})

  return (
    keys.length === LEGACY_PARALLEL_ARRAY_CAMPAIGN_INDEX_KEYS.length &&
    LEGACY_PARALLEL_ARRAY_CAMPAIGN_INDEX_KEYS.every(
      (key, position) => keys[position] === key,
    )
  )
}

async function reconcileRetailMediaCampaignIndexes() {
  if (!campaignIndexReconciliationPromise) {
    campaignIndexReconciliationPromise = (async () => {
      try {
        const indexes =
          await Campaign.collection.indexes()

        const legacyIndex =
          indexes.find(
            isLegacyParallelArrayCampaignIndex,
          )

        if (legacyIndex?.name) {
          await Campaign.collection.dropIndex(
            legacyIndex.name,
          )
        }
      } catch (error) {
        if (
          error?.code === 26 ||
          error?.codeName === 'NamespaceNotFound'
        ) {
          return
        }

        campaignIndexReconciliationPromise = null
        throw error
      }
    })()
  }

  return campaignIndexReconciliationPromise
}

function razorpayModeFromKeyId(keyId) {
  const value = String(keyId || '').trim()

  if (value.startsWith('rzp_test_')) {
    return 'test'
  }

  if (value.startsWith('rzp_live_')) {
    return 'live'
  }

  return 'unknown'
}

function placementPricingRows(placements = []) {
  return placements.map((placement) => ({
    placement,
    amountMinor:
      RETAIL_MEDIA_PLACEMENT_PRICING_MINOR[placement] || 0,
  }))
}

function placementPricingTotalMinor(placements = []) {
  return placementPricingRows(placements).reduce(
    (total, row) => total + Number(row.amountMinor || 0),
    0,
  )
}

function assertRetailMediaTestPaymentConfiguration() {
  const publicConfig = getRazorpayPublicConfig()
  const providerMode = razorpayModeFromKeyId(publicConfig.keyId)

  if (!publicConfig.configured) {
    throw new ApiError(
      503,
      'Razorpay test payment is not configured for Retail Media.',
      [
        {
          code: 'M21_RETAIL_MEDIA_PAYMENT_PROVIDER_NOT_CONFIGURED',
        },
      ],
    )
  }

  if (providerMode !== 'test') {
    throw new ApiError(
      409,
      'Retail Media payment is restricted to Razorpay test mode in this environment.',
      [
        {
          code: 'M21_RETAIL_MEDIA_TEST_PAYMENT_ONLY',
        },
      ],
    )
  }

  return {
    publicConfig,
    providerMode,
  }
}

const SENSITIVE_TARGETING_PATTERN =
  /(allerg|medical|diagnos|disease|relig|ethnic|race|pregnan|disab|sexual|politic|mental.?health|health.?condition)/i

const PUBLIC_SERVING_ENTITY_TYPES =
  new Set([
    'brand',
    'generic',
  ])

function stringId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY identity is required.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function normalizeTag(value) {
  return String(
    value || '',
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

function uniqueTags(values = []) {
  return [
    ...new Set(
      values
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ].slice(0, 30)
}

function assertNoSensitiveTargeting(tags) {
  const sensitiveTag =
    tags.find(
      (tag) =>
        SENSITIVE_TARGETING_PATTERN.test(
          tag,
        ),
    )

  if (sensitiveTag) {
    throw new ApiError(
      400,
      'Sensitive health, allergy or protected-class signals cannot be used for Retail Media targeting.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_SENSITIVE_TARGETING_FORBIDDEN',

          tag:
            sensitiveTag,
        },
      ],
    )
  }
}

function fingerprint(value) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      JSON.stringify(
        value,
      ),
    )
    .digest(
      'hex',
    )
}

function serializeCampaign(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringId(
        item._id,
      ),

    sourceHostCampaignBriefId:
      stringId(
        item.sourceHostCampaignBriefId,
      ),

    organizationId:
      stringId(
        item.organizationId,
      ),

    brandId:
      stringId(
        item.brandId,
      ),

    title:
      item.title,

    objective:
      item.objective,

    marketCodes:
      item.marketCodes || [],

    placements:
      item.placements || [],

    startsAt:
      item.startsAt || null,

    endsAt:
      item.endsAt || null,

    budget:
      item.budget || {},

    bidMinor:
      item.bidMinor || 0,

    qualityScore:
      item.qualityScore || 0,

    promotedEntityType:
      item.promotedEntityType,

    promotedEntityId:
      item.promotedEntityId || '',

    contextualTags:
      item.contextualTags || [],

    frequencyCapPerContext:
      item.frequencyCapPerContext,

    creative:
      item.creative || {},

    commercialDisclosure:
      item.commercialDisclosure,

    status:
      item.status,

    review: {
      decision:
        item.review?.decision ||
        'pending',

      reason:
        item.review?.reason ||
        '',

      evidenceRefs:
        item.review?.evidenceRefs ||
        [],

      reviewedAt:
        item.review?.reviewedAt ||
        null,
    },

    payment: {
      status:
        item.payment?.status ||
        'unpaid',

      provider:
        item.payment?.provider ||
        'razorpay',

      providerMode:
        item.payment?.providerMode ||
        'unknown',

      currency:
        item.payment?.currency ||
        RETAIL_MEDIA_PAYMENT_CURRENCY,

      requiredAmountMinor:
        Number(
          item.payment?.requiredAmountMinor ||
            placementPricingTotalMinor(
              item.placements || [],
            ),
        ),

      placementCharges:
        item.payment?.placementCharges?.length
          ? item.payment.placementCharges
          : placementPricingRows(
              item.placements || [],
            ),

      providerOrderId:
        item.payment?.providerOrderId ||
        '',

      providerPaymentId:
        item.payment?.providerPaymentId ||
        '',

      paidAt:
        item.payment?.paidAt ||
        null,

      recipient:
        RETAIL_MEDIA_PAYMENT_RECIPIENT,
    },

    activatedAt:
      item.activatedAt || null,

    pausedAt:
      item.pausedAt || null,

    createdAt:
      item.createdAt || null,

    updatedAt:
      item.updatedAt || null,
  }
}

function serializeDecisionLog(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringId(
        item._id,
      ),

    campaignId:
      stringId(
        item.campaignId,
      ),

    organizationId:
      stringId(
        item.organizationId,
      ),

    placement:
      item.placement,

    marketCode:
      item.marketCode,

    contextFingerprint:
      item.contextFingerprint,

    promotedEntityType:
      item.promotedEntityType,

    promotedEntityId:
      item.promotedEntityId || '',

    outcome:
      item.outcome,

    reasonCodes:
      item.reasonCodes || [],

    sponsorLabel:
      item.sponsorLabel,

    sponsoredRankScore:
      item.sponsoredRankScore ??
      null,

    organicAlternativeRequired:
      item.organicAlternativeRequired ===
      true,

    safetySeparation:
      item.safetySeparation,

    decidedAt:
      item.decidedAt,
  }
}

export async function requireRetailMediaFeature() {
  const flag =
    await AdminFeatureFlag.findOne({
      key:
        M21_RETAIL_MEDIA_FEATURE_FLAG,

      enabled:
        true,

      environments:
        env.nodeEnv,
    }).lean()

  if (flag) {
    return {
      ...flag,
      testModeBypass: false,
      bypassReason: null,
    }
  }

  const publicConfig =
    getRazorpayPublicConfig()
  const providerMode =
    razorpayModeFromKeyId(
      publicConfig.keyId,
    )
  const testPaymentWorkspace =
    publicConfig.configured &&
    providerMode === 'test'

  if (
    env.nodeEnv !== 'production' ||
    testPaymentWorkspace
  ) {
    return {
      key: M21_RETAIL_MEDIA_FEATURE_FLAG,
      enabled: true,
      environments: [env.nodeEnv],
      testModeBypass: true,
      bypassReason:
        testPaymentWorkspace
          ? 'razorpay_test_mode'
          : 'non_production',
    }
  }

  throw new ApiError(
    404,
    'Retail Media expansion is not enabled for this environment.',
    [
      {
        code:
          'M21_RETAIL_MEDIA_FEATURE_DISABLED',

        featureFlagKey:
          M21_RETAIL_MEDIA_FEATURE_FLAG,
      },
    ],
  )
}

export async function createRetailMediaCampaignFromBrief({
  briefId,
  input,
  actorUser,
}) {
  await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const brief =
    await HostCampaignBrief.findOne({
      _id:
        briefId,

      organizationId:
        context.organization._id,

      status:
        'submitted_for_future_media_review',
    }).lean()

  if (!brief) {
    throw new ApiError(
      404,
      'Submitted Host Campaign Brief was not found for this organization.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_SOURCE_BRIEF_NOT_FOUND',
        },
      ],
    )
  }

  const existing =
    await Campaign.findOne({
      sourceHostCampaignBriefId:
        brief._id,
    }).lean()

  if (existing) {
    return {
      campaign:
        serializeCampaign(
          existing,
        ),

      deduplicated:
        true,
    }
  }

  const contextualTags =
    uniqueTags(
      input.contextualTags,
    )

  assertNoSensitiveTargeting(
    contextualTags,
  )

  const placements =
    input.placements?.length
      ? input.placements
      : brief.requestedPlacements

  const paymentPlacementCharges =
    placementPricingRows(placements)

  const paymentRequiredAmountMinor =
    placementPricingTotalMinor(placements)

  await reconcileRetailMediaCampaignIndexes()

  const campaign =
    await Campaign.create({
      sourceHostCampaignBriefId:
        brief._id,

      organizationId:
        context.organization._id,

      brandId:
        brief.brandId || null,

      authorityGrantId:
        brief.authorityGrantId || null,

      title:
        brief.title,

      objective:
        brief.objective,

      marketCodes:
        brief.marketCodes,

      placements,

      startsAt:
        input.startsAt ||
        brief.startsAt ||
        null,

      endsAt:
        input.endsAt ||
        brief.endsAt ||
        null,

      budget: {
        dailyAmountMinor:
          input.dailyBudgetMinor,

        lifetimeAmountMinor:
          input.lifetimeBudgetMinor ||
          brief.budget?.amountMinor ||
          0,

        currency:
          brief.budget?.currency ||
          'INR',
      },

      bidMinor:
        input.bidMinor,

      qualityScore:
        input.qualityScore,

      promotedEntityType:
        brief.promotedEntityType,

      promotedEntityId:
        brief.promotedEntityId,

      contextualTags,

      frequencyCapPerContext:
        input.frequencyCapPerContext,

      creative: {
        headline:
          input.headline,

        body:
          input.body,

        landingRef:
          input.landingRef,

        sponsorLabel:
          input.sponsorLabel,
      },

      commercialDisclosure:
        brief.commercialDisclosure,

      status:
        'pending_review',

      review: {
        decision:
          'pending',
      },

      payment: {
        status: 'unpaid',
        provider: 'razorpay',
        providerMode: 'unknown',
        currency: RETAIL_MEDIA_PAYMENT_CURRENCY,
        requiredAmountMinor:
          paymentRequiredAmountMinor,
        placementCharges:
          paymentPlacementCharges,
        providerOrderId: '',
        providerPaymentId: '',
        paidAt: null,
      },

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    campaign:
      serializeCampaign(
        campaign,
      ),

    deduplicated:
      false,

    policy: {
      sourceBriefReused:
        true,

      sponsoredDisclosureRequired:
        true,

      organicRankingOverrideAllowed:
        false,

      sensitiveTargetingAllowed:
        false,

      productOrRecipeServingRequiresIndependentSafetyEligibility:
        true,

      billingOrSettlementClaimed:
        false,
    },
  }
}

export async function listHostRetailMediaCampaigns({
  actorUser,
}) {
  await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.read',
  )

  const campaigns =
    await Campaign.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    campaigns:
      campaigns.map(
        serializeCampaign,
      ),
  }
}

export async function getHostRetailMediaPricing({
  actorUser,
}) {
  const feature =
    await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.read',
  )

  const publicConfig =
    getRazorpayPublicConfig()

  return {
    currency:
      RETAIL_MEDIA_PAYMENT_CURRENCY,

    recipient:
      RETAIL_MEDIA_PAYMENT_RECIPIENT,

    pricingModel:
      'fixed_placement_test_fee',

    placementPricing:
      Object.entries(
        RETAIL_MEDIA_PLACEMENT_PRICING_MINOR,
      ).map(
        ([placement, amountMinor]) => ({
          placement,
          amountMinor,
        }),
      ),

    paymentProvider: {
      provider: 'razorpay',
      configured:
        publicConfig.configured,
      mode:
        razorpayModeFromKeyId(
          publicConfig.keyId,
        ),
    },

    testModeBypass:
      feature.testModeBypass ===
      true,
  }
}

export async function createRetailMediaCampaignPaymentIntent({
  campaignId,
  actorUser,
}) {
  await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const campaign =
    await Campaign.findOne({
      _id: campaignId,
      organizationId:
        context.organization._id,
    })

  if (!campaign) {
    throw new ApiError(
      404,
      'Retail Media Campaign was not found for this organization.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_CAMPAIGN_NOT_FOUND',
        },
      ],
    )
  }

  if (campaign.status !== 'pending_review') {
    throw new ApiError(
      409,
      'Only a campaign waiting for Super Admin review can be paid.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_STATUS_INVALID',
        },
      ],
    )
  }

  if (campaign.payment?.status === 'paid') {
    return {
      campaign:
        serializeCampaign(campaign),
      checkout: null,
      alreadyPaid: true,
    }
  }

  const {
    publicConfig,
    providerMode,
  } =
    assertRetailMediaTestPaymentConfiguration()

  const requiredAmountMinor =
    Number(
      campaign.payment?.requiredAmountMinor ||
        placementPricingTotalMinor(
          campaign.placements,
        ),
    )

  if (requiredAmountMinor <= 0) {
    throw new ApiError(
      409,
      'This Retail Media campaign does not have a payable placement amount.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_AMOUNT_INVALID',
        },
      ],
    )
  }

  if (
    campaign.payment?.status ===
      'initiated' &&
    campaign.payment?.providerOrderId
  ) {
    return {
      campaign:
        serializeCampaign(campaign),
      checkout: {
        configured: true,
        provider: 'razorpay',
        mode: providerMode,
        keyId: publicConfig.keyId,
        providerOrderId:
          campaign.payment.providerOrderId,
        amountMinor:
          requiredAmountMinor,
        currency:
          campaign.payment.currency ||
          RETAIL_MEDIA_PAYMENT_CURRENCY,
        recipient:
          RETAIL_MEDIA_PAYMENT_RECIPIENT,
      },
      alreadyPaid: false,
    }
  }

  const providerOrder =
    await createRazorpayOrder({
      amountMinor:
        requiredAmountMinor,
      currency:
        RETAIL_MEDIA_PAYMENT_CURRENCY,
      receipt:
        `rm_${String(campaign._id)}`.slice(
          0,
          40,
        ),
      notes: {
        purpose:
          'epantry_retail_media_test_campaign',
        campaignId:
          String(campaign._id),
        organizationId:
          String(context.organization._id),
      },
    })

  campaign.payment = {
    status: 'initiated',
    provider: 'razorpay',
    providerMode,
    currency:
      providerOrder.currency ||
      RETAIL_MEDIA_PAYMENT_CURRENCY,
    requiredAmountMinor:
      requiredAmountMinor,
    placementCharges:
      campaign.payment?.placementCharges?.length
        ? campaign.payment.placementCharges
        : placementPricingRows(
            campaign.placements,
          ),
    providerOrderId:
      providerOrder.providerOrderId,
    providerPaymentId: '',
    paidAt: null,
  }

  await campaign.save()

  return {
    campaign:
      serializeCampaign(campaign),
    checkout: {
      configured: true,
      provider: 'razorpay',
      mode: providerMode,
      keyId:
        providerOrder.keyId ||
        publicConfig.keyId,
      providerOrderId:
        providerOrder.providerOrderId,
      amountMinor:
        requiredAmountMinor,
      currency:
        providerOrder.currency ||
        RETAIL_MEDIA_PAYMENT_CURRENCY,
      recipient:
        RETAIL_MEDIA_PAYMENT_RECIPIENT,
    },
    alreadyPaid: false,
  }
}

export async function verifyRetailMediaCampaignPayment({
  campaignId,
  input,
  actorUser,
}) {
  await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const campaign =
    await Campaign.findOne({
      _id: campaignId,
      organizationId:
        context.organization._id,
    })

  if (!campaign) {
    throw new ApiError(
      404,
      'Retail Media Campaign was not found for this organization.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_CAMPAIGN_NOT_FOUND',
        },
      ],
    )
  }

  if (campaign.payment?.status === 'paid') {
    return {
      campaign:
        serializeCampaign(campaign),
      verified: true,
      deduplicated: true,
    }
  }

  const { providerMode } =
    assertRetailMediaTestPaymentConfiguration()

  const providerOrderId =
    String(
      input.razorpayOrderId ||
        '',
    ).trim()

  if (
    !campaign.payment?.providerOrderId ||
    campaign.payment.providerOrderId !==
      providerOrderId
  ) {
    throw new ApiError(
      409,
      'Retail Media payment order does not match this campaign.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_ORDER_MISMATCH',
        },
      ],
    )
  }

  const signatureValid =
    verifyRazorpayCheckoutSignature({
      providerOrderId,
      providerPaymentId:
        input.razorpayPaymentId,
      signature:
        input.razorpaySignature,
    })

  if (!signatureValid) {
    throw new ApiError(
      409,
      'Retail Media test payment signature could not be verified.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_SIGNATURE_INVALID',
        },
      ],
    )
  }

  const providerPayment =
    await fetchRazorpayPayment({
      providerPaymentId:
        input.razorpayPaymentId,
    })

  const requiredAmountMinor =
    Number(
      campaign.payment?.requiredAmountMinor ||
        0,
    )

  if (
    providerPayment.providerOrderId !==
      providerOrderId ||
    providerPayment.amountMinor !==
      requiredAmountMinor ||
    providerPayment.currency !==
      String(
        campaign.payment?.currency ||
          RETAIL_MEDIA_PAYMENT_CURRENCY,
      ).toUpperCase() ||
    providerPayment.captured !== true
  ) {
    throw new ApiError(
      409,
      'Retail Media test payment has not been captured for the expected campaign amount.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_NOT_CAPTURED',
        },
      ],
    )
  }

  campaign.payment.status = 'paid'
  campaign.payment.provider = 'razorpay'
  campaign.payment.providerMode = providerMode
  campaign.payment.providerPaymentId =
    providerPayment.providerPaymentId
  campaign.payment.paidAt =
    new Date()

  await campaign.save()

  return {
    campaign:
      serializeCampaign(campaign),
    verified: true,
    deduplicated: false,
  }
}

export async function transitionHostRetailMediaCampaign({
  campaignId,
  action,
  actorUser,
}) {
  await requireRetailMediaFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'campaigns.manage',
  )

  const campaign =
    await Campaign.findOne({
      _id:
        campaignId,

      organizationId:
        context.organization._id,
    })

  if (!campaign) {
    throw new ApiError(
      404,
      'Retail Media Campaign was not found for this organization.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_CAMPAIGN_NOT_FOUND',
        },
      ],
    )
  }

  if (
    action ===
    'activate'
  ) {
    if (campaign.payment?.status !== 'paid') {
      throw new ApiError(
        409,
        'Campaign payment must be completed before activation.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_PAYMENT_REQUIRED',
          },
        ],
      )
    }

    if (
      campaign.status !==
        'approved' ||
      campaign.review?.decision !==
        'approved'
    ) {
      throw new ApiError(
        409,
        'Only an approved Retail Media Campaign can be activated.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_APPROVAL_REQUIRED',
          },
        ],
      )
    }

    const now =
      new Date()

    if (
      campaign.endsAt &&
      campaign.endsAt <= now
    ) {
      campaign.status =
        'ended'

      await campaign.save()

      throw new ApiError(
        409,
        'Expired Retail Media Campaign cannot be activated.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_CAMPAIGN_EXPIRED',
          },
        ],
      )
    }

    campaign.status =
      'active'

    campaign.activatedAt =
      now

    campaign.pausedAt =
      null
  } else if (
    action ===
    'pause'
  ) {
    if (
      campaign.status !==
      'active'
    ) {
      throw new ApiError(
        409,
        'Only an active Retail Media Campaign can be paused.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_CAMPAIGN_NOT_ACTIVE',
          },
        ],
      )
    }

    campaign.status =
      'paused'

    campaign.pausedAt =
      new Date()
  } else {
    if (
      campaign.status !==
      'paused'
    ) {
      throw new ApiError(
        409,
        'Only a paused Retail Media Campaign can be resumed.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_CAMPAIGN_NOT_PAUSED',
          },
        ],
      )
    }

    campaign.status =
      'active'

    campaign.pausedAt =
      null
  }

  await campaign.save()

  return {
    campaign:
      serializeCampaign(
        campaign,
      ),
  }
}

export async function listAdminRetailMediaCampaigns({
  status = '',
  limit = 100,
}) {
  await requireRetailMediaFeature()

  const filter =
    status
      ? {
          status,
        }
      : {}

  const campaigns =
    await Campaign.find(
      filter,
    )
      .sort({
        createdAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    campaigns:
      campaigns.map(
        serializeCampaign,
      ),
  }
}

export async function reviewAdminRetailMediaCampaign({
  campaignId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  await requireRetailMediaFeature()

  const campaign =
    await Campaign.findOne({
      _id:
        campaignId,

      status:
        'pending_review',
    })

  if (!campaign) {
    throw new ApiError(
      404,
      'Pending Retail Media Campaign was not found.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PENDING_CAMPAIGN_NOT_FOUND',
        },
      ],
    )
  }

  if (
    input.decision === 'approve' &&
    campaign.payment?.status !== 'paid'
  ) {
    throw new ApiError(
      409,
      'Host payment must be completed before Super Admin approval.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAYMENT_REQUIRED_FOR_APPROVAL',
        },
      ],
    )
  }

  const before =
    serializeCampaign(
      campaign,
    )

  campaign.status =
    input.decision ===
      'approve'
      ? 'approved'
      : 'rejected'

  campaign.review = {
    decision:
      input.decision ===
        'approve'
        ? 'approved'
        : 'rejected',

    reason:
      input.reason,

    evidenceRefs:
      input.evidenceRefs,

    reviewedByUserId:
      actorId(
        actorUser,
      ),

    reviewedAt:
      new Date(),
  }

  await campaign.save()

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    entityType:
      'retail_media_campaign',

    entityId:
      stringId(
        campaign._id,
      ),

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeCampaign(
        campaign,
      ),

    metadata: {
      operation:
        'm21_retail_media_campaign_review',

      decision:
        input.decision,

      organicRankingOverrideAllowed:
        false,

      sensitiveTargetingAllowed:
        false,
    },

    requestId,
  })

  return {
    campaign:
      serializeCampaign(
        campaign,
      ),
  }
}

function activeCampaignFilter({
  placement,
  marketCode,
  now,
}) {
  return {
    status:
      'active',

    placements:
      placement,

    marketCodes:
      marketCode,

    promotedEntityType: {
      $in: [
        ...PUBLIC_SERVING_ENTITY_TYPES,
      ],
    },

    $and: [
      {
        $or: [
          {
            startsAt:
              null,
          },
          {
            startsAt: {
              $lte:
                now,
            },
          },
        ],
      },
      {
        $or: [
          {
            endsAt:
              null,
          },
          {
            endsAt: {
              $gt:
                now,
            },
          },
        ],
      },
    ],
  }
}

function sponsoredScore({
  campaign,
  contextTags,
}) {
  const campaignTags =
    new Set(
      campaign.contextualTags ||
        [],
    )

  const overlap =
    contextTags.reduce(
      (
        count,
        tag,
      ) =>
        count +
        (
          campaignTags.has(
            tag,
          )
            ? 1
            : 0
        ),
      0,
    )

  const relevance =
    campaignTags.size ===
      0
      ? 0.5
      : Math.min(
          overlap /
            Math.max(
              campaignTags.size,
              1,
            ),
          1,
        )

  const quality =
    Number(
      campaign.qualityScore ||
      0,
    ) /
    100

  const bid =
    Math.min(
      Number(
        campaign.bidMinor ||
        0,
      ) /
        10000,
      1,
    )

  return Number(
    (
      relevance *
        0.55 +
      quality *
        0.35 +
      bid *
        0.1
    ).toFixed(
      6,
    ),
  )
}

async function writeDecisionLog({
  campaign,
  placement,
  marketCode,
  contextFingerprint,
  outcome,
  reasonCodes,
  sponsoredRankScore,
}) {
  const record =
    await AdDecisionLog.create({
      campaignId:
        campaign?._id ||
        null,

      organizationId:
        campaign?.organizationId ||
        null,

      placement,
      marketCode,
      contextFingerprint,

      promotedEntityType:
        campaign?.promotedEntityType ||
        'generic',

      promotedEntityId:
        campaign?.promotedEntityId ||
        '',

      outcome,
      reasonCodes,

      sponsorLabel:
        campaign?.creative
          ?.sponsorLabel ||
        'Sponsored',

      sponsoredRankScore:
        sponsoredRankScore ??
        null,

      organicAlternativeRequired:
        true,

      safetySeparation: {
        hardConstraintsEvaluatedBeforePaidRanking:
          true,

        sensitiveTargetingUsed:
          false,

        productOrRecipeServingSuppressedWithoutSafetyEligibility:
          true,
      },
    })

  return serializeDecisionLog(
    record,
  )
}

export async function decideLowRiskSponsoredPlacement({
  input,
}) {
  await requireRetailMediaFeature()

  const marketCode =
    String(
      input.marketCode ||
      'IN',
    )
      .trim()
      .toUpperCase()

  const contextTags =
    uniqueTags(
      input.contextTags,
    )

  assertNoSensitiveTargeting(
    contextTags,
  )

  const contextFingerprint =
    fingerprint({
      placement:
        input.placement,

      marketCode,

      contextTags,
    })

  const now =
    new Date()

  const campaigns =
    await Campaign.find(
      activeCampaignFilter({
        placement:
          input.placement,

        marketCode,

        now,
      }),
    )
      .sort({
        qualityScore:
          -1,

        createdAt:
          1,
      })
      .limit(100)
      .lean()

  if (!campaigns.length) {
    const decisionLog =
      await writeDecisionLog({
        campaign:
          null,

        placement:
          input.placement,

        marketCode,

        contextFingerprint,

        outcome:
          'no_eligible_campaign',

        reasonCodes: [
          'NO_LOW_RISK_SPONSORED_CAMPAIGN',
        ],

        sponsoredRankScore:
          null,
      })

    return {
      sponsored:
        null,

      decisionLog,

      policy: {
        sponsoredLabelRequired:
          true,

        organicPathRequired:
          true,

        organicRankingScoreUntouched:
          true,

        sensitiveTargetingUsed:
          false,

        productOrRecipeAdsServedWithoutSafetyEligibility:
          false,
      },
    }
  }

  const ranked =
    campaigns
      .map(
        (campaign) => ({
          campaign,

          score:
            sponsoredScore({
              campaign,
              contextTags,
            }),
        }),
      )
      .sort(
        (left, right) =>
          right.score -
            left.score ||
          String(
            left.campaign._id,
          ).localeCompare(
            String(
              right.campaign._id,
            ),
          ),
      )

  let selected =
    null

  for (const candidate of ranked) {
    const recentCount =
      await AdDecisionLog.countDocuments({
        campaignId:
          candidate.campaign._id,

        contextFingerprint,

        outcome:
          'served',

        decidedAt: {
          $gte:
            new Date(
              now.getTime() -
                24 *
                  60 *
                  60 *
                  1000,
            ),
        },
      })

    if (
      recentCount <
      candidate.campaign
        .frequencyCapPerContext
    ) {
      selected =
        candidate

      break
    }
  }

  if (!selected) {
    const decisionLog =
      await writeDecisionLog({
        campaign:
          null,

        placement:
          input.placement,

        marketCode,

        contextFingerprint,

        outcome:
          'suppressed',

        reasonCodes: [
          'FREQUENCY_CAP_REACHED',
        ],

        sponsoredRankScore:
          null,
      })

    return {
      sponsored:
        null,

      decisionLog,

      policy: {
        sponsoredLabelRequired:
          true,

        organicPathRequired:
          true,

        organicRankingScoreUntouched:
          true,

        sensitiveTargetingUsed:
          false,

        productOrRecipeAdsServedWithoutSafetyEligibility:
          false,
      },
    }
  }

  const decisionLog =
    await writeDecisionLog({
      campaign:
        selected.campaign,

      placement:
        input.placement,

      marketCode,

      contextFingerprint,

      outcome:
        'served',

      reasonCodes: [
        'LOW_RISK_ENTITY_TYPE',
        'CONTEXTUAL_RELEVANCE',
        'POLICY_APPROVED_CAMPAIGN',
        'ORGANIC_PATH_PRESERVED',
      ],

      sponsoredRankScore:
        selected.score,
    })

  return {
    sponsored: {
      campaignId:
        stringId(
          selected.campaign._id,
        ),

      organizationId:
        stringId(
          selected.campaign
            .organizationId,
        ),

      promotedEntityType:
        selected.campaign
          .promotedEntityType,

      promotedEntityId:
        selected.campaign
          .promotedEntityId ||
        '',

      headline:
        selected.campaign
          .creative
          ?.headline ||
        '',

      body:
        selected.campaign
          .creative?.body ||
        '',

      landingRef:
        selected.campaign
          .creative
          ?.landingRef ||
        '',

      sponsorLabel:
        selected.campaign
          .creative
          ?.sponsorLabel ||
        'Sponsored',

      whyAmISeeingThis: [
        'This is a paid placement.',
        'It matched this page context using non-sensitive contextual signals.',
        'Paid rank is separate from organic relevance and safety conclusions.',
      ],
    },

    decisionLog,

    policy: {
      sponsoredLabelRequired:
        true,

      organicPathRequired:
        true,

      organicRankingScoreUntouched:
        true,

      sensitiveTargetingUsed:
        false,

      productOrRecipeAdsServedWithoutSafetyEligibility:
        false,
    },
  }
}

export async function listAdminAdDecisionLogs({
  limit = 100,
  outcome = '',
}) {
  await requireRetailMediaFeature()

  const filter =
    outcome
      ? {
          outcome,
        }
      : {}

  const records =
    await AdDecisionLog.find(
      filter,
    )
      .sort({
        decidedAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    adDecisionLogs:
      records.map(
        serializeDecisionLog,
      ),
  }
}