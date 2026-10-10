import crypto from 'crypto'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createRetailMediaImageUploadIntent,
} from '../../integrations/media/cloudinary.provider.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  AdminFeatureFlag,
} from '../adminGovernance/adminGovernance.models.js'

import {
  Brand,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  buildPublicProductSlug,
  getPublicProductBySlug,
} from '../catalog/catalog.public.service.js'

import {
  HostOffer,
  MarketplaceOrganization,
  PriceRule,
} from '../marketplace/marketplace.models.js'

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
  createNotificationIntentBestEffort,
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  assertHostOperationsPermission,
  resolveHostOperationsContext,
} from '../hostOperations/hostOperations.service.js'

import {
  AdDecisionLog,
  Campaign,
  RETAIL_MEDIA_DURATION_MINUTES,
  RETAIL_MEDIA_PLACEMENT_SLOTS,
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

const RETAIL_MEDIA_DEFAULT_DURATION_MINUTES = 1440
const RETAIL_MEDIA_RESERVATION_HOLD_MINUTES = 15
const RETAIL_MEDIA_DURATION_OPTIONS = Object.freeze([
  { durationMinutes: 240, label: '4 hours' },
  { durationMinutes: 720, label: '12 hours' },
  { durationMinutes: 1440, label: '1 day' },
  { durationMinutes: 4320, label: '3 days' },
  { durationMinutes: 10080, label: '7 days' },
  { durationMinutes: 20160, label: '14 days' },
  { durationMinutes: 43200, label: '30 days' },
])

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

function normalizeDurationMinutes(value) {
  const durationMinutes = Number(value || 0)

  return RETAIL_MEDIA_DURATION_MINUTES.includes(durationMinutes)
    ? durationMinutes
    : RETAIL_MEDIA_DEFAULT_DURATION_MINUTES
}

function durationAdjustedAmountMinor(
  amountMinor,
  durationMinutes = RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,
) {
  const normalizedDurationMinutes =
    normalizeDurationMinutes(durationMinutes)

  return Math.max(
    1,
    Math.round(
      (Number(amountMinor || 0) * normalizedDurationMinutes) /
        RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,
    ),
  )
}

function placementPricingRows(
  placements = [],
  durationMinutes = RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,
) {
  return placements.map((placement) => ({
    placement,
    amountMinor:
      durationAdjustedAmountMinor(
        RETAIL_MEDIA_PLACEMENT_PRICING_MINOR[placement] || 0,
        durationMinutes,
      ),
  }))
}

function placementPricingTotalMinor(
  placements = [],
  durationMinutes = RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,
) {
  return placementPricingRows(placements, durationMinutes).reduce(
    (total, row) => total + Number(row.amountMinor || 0),
    0,
  )
}

function placementSlotDefinition(
  placement,
  slotKey,
) {
  return (
    RETAIL_MEDIA_PLACEMENT_SLOTS[placement] || []
  ).find((slot) => slot.key === slotKey) || null
}

function normalizePlacementSelections({
  placements = [],
  placementSelections = [],
}) {
  const uniquePlacements = [
    ...new Set(
      (placements || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ]

  return uniquePlacements.map((placement) => {
    const requested =
      (placementSelections || []).find(
        (selection) => selection?.placement === placement,
      ) || null

    const slot =
      placementSlotDefinition(
        placement,
        requested?.slotKey,
      ) ||
      RETAIL_MEDIA_PLACEMENT_SLOTS[placement]?.[0] ||
      null

    if (!slot) {
      throw new ApiError(
        400,
        'Choose a valid page position for every selected placement.',
        [
          {
            code: 'M21_RETAIL_MEDIA_PLACEMENT_SLOT_INVALID',
            placement,
          },
        ],
      )
    }

    return {
      placement,
      slotKey: slot.key,
      slotLabel: slot.label,
    }
  })
}

function campaignReservationWindow(campaign) {
  const startValue =
    campaign?.scheduledStartsAt ||
    campaign?.startsAt ||
    null

  if (!startValue) {
    return {
      startsAt: null,
      endsAt: null,
    }
  }

  const startsAt = new Date(startValue)
  const explicitEnd =
    campaign?.scheduledEndsAt ||
    campaign?.endsAt ||
    null

  const endsAt = explicitEnd
    ? new Date(explicitEnd)
    : new Date(
        startsAt.getTime() +
          normalizeDurationMinutes(campaign?.durationMinutes) * 60 * 1000,
      )

  return {
    startsAt,
    endsAt,
  }
}

function reservationBlocksSlot(
  campaign,
  now = new Date(),
) {
  if (
    !campaign ||
    ['rejected', 'ended'].includes(campaign.status)
  ) {
    return false
  }

  if (campaign.payment?.status === 'paid') {
    return true
  }

  if (
    campaign.payment?.status === 'initiated' &&
    campaign.reservationHeldUntil &&
    new Date(campaign.reservationHeldUntil) > now
  ) {
    return true
  }

  return false
}

async function findSlotAvailability({
  placement,
  slotKey,
  durationMinutes,
  requestedStartAt = null,
  excludeCampaignId = null,
  now = new Date(),
}) {
  const slot =
    placementSlotDefinition(
      placement,
      slotKey,
    )

  if (!slot) {
    throw new ApiError(
      400,
      'Choose a valid page position.',
      [
        {
          code: 'M21_RETAIL_MEDIA_PLACEMENT_SLOT_INVALID',
          placement,
          slotKey,
        },
      ],
    )
  }

  const duration =
    normalizeDurationMinutes(
      durationMinutes,
    )

  const requested =
    requestedStartAt
      ? new Date(requestedStartAt)
      : new Date(now)

  const requestedStartsAt =
    Number.isNaN(requested.getTime()) || requested < now
      ? new Date(now)
      : requested

  const filter = {
    status: {
      $nin: ['rejected', 'ended'],
    },
    placementSelections: {
      $elemMatch: {
        placement,
        slotKey,
      },
    },
  }

  if (excludeCampaignId) {
    filter._id = {
      $ne: excludeCampaignId,
    }
  }

  const candidates =
    await Campaign.find(filter)
      .select(
        '_id status payment durationMinutes startsAt endsAt scheduledStartsAt scheduledEndsAt reservationHeldUntil placementSelections',
      )
      .sort({
        scheduledStartsAt: 1,
        startsAt: 1,
      })
      .lean()

  const reservations =
    candidates
      .filter((campaign) => reservationBlocksSlot(campaign, now))
      .map((campaign) => ({
        campaignId: stringId(campaign._id),
        ...campaignReservationWindow(campaign),
      }))
      .filter(
        (reservation) =>
          reservation.startsAt &&
          reservation.endsAt &&
          reservation.endsAt > now,
      )
      .sort(
        (left, right) =>
          left.startsAt.getTime() - right.startsAt.getTime(),
      )

  let cursor = new Date(requestedStartsAt)
  const durationMs = duration * 60 * 1000

  for (const reservation of reservations) {
    const requestedEnd =
      new Date(cursor.getTime() + durationMs)

    if (reservation.endsAt <= cursor) {
      continue
    }

    if (reservation.startsAt >= requestedEnd) {
      break
    }

    cursor = new Date(reservation.endsAt)
  }

  const availableEndsAt =
    new Date(cursor.getTime() + durationMs)

  return {
    placement,
    slotKey: slot.key,
    slotLabel: slot.label,
    durationMinutes: duration,
    requestedStartsAt,
    requestedEndsAt:
      new Date(requestedStartsAt.getTime() + durationMs),
    available:
      cursor.getTime() === requestedStartsAt.getTime(),
    nextAvailableAt: cursor,
    nextAvailableEndsAt: availableEndsAt,
  }
}

async function findCommonPlacementWindow({
  placementSelections,
  durationMinutes,
  requestedStartAt = null,
  excludeCampaignId = null,
}) {
  let candidateStart =
    requestedStartAt
      ? new Date(requestedStartAt)
      : new Date()

  if (
    Number.isNaN(candidateStart.getTime()) ||
    candidateStart < new Date()
  ) {
    candidateStart = new Date()
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const availability =
      await Promise.all(
        placementSelections.map((selection) =>
          findSlotAvailability({
            placement: selection.placement,
            slotKey: selection.slotKey,
            durationMinutes,
            requestedStartAt: candidateStart,
            excludeCampaignId,
          }),
        ),
      )

    const nextStartMs =
      Math.max(
        candidateStart.getTime(),
        ...availability.map((item) =>
          new Date(item.nextAvailableAt).getTime(),
        ),
      )

    if (nextStartMs === candidateStart.getTime()) {
      const duration = normalizeDurationMinutes(durationMinutes)

      return {
        scheduledStartsAt: candidateStart,
        scheduledEndsAt:
          new Date(
            candidateStart.getTime() + duration * 60 * 1000,
          ),
        availability,
      }
    }

    candidateStart = new Date(nextStartMs)
  }

  throw new ApiError(
    409,
    'A common free window could not be found for the selected ad positions.',
    [
      {
        code: 'M21_RETAIL_MEDIA_PLACEMENT_WINDOW_UNAVAILABLE',
      },
    ],
  )
}

async function endExpiredRetailMediaCampaigns(now = new Date()) {
  await Campaign.updateMany(
    {
      status: {
        $in: ['active', 'paused'],
      },
      endsAt: {
        $ne: null,
        $lte: now,
      },
    },
    {
      $set: {
        status: 'ended',
      },
    },
  )
}

async function activateApprovedRetailMediaCampaign(
  campaign,
  {
    now = new Date(),
  } = {},
) {
  if (
    !campaign ||
    campaign.status !== 'approved' ||
    campaign.payment?.status !== 'paid' ||
    campaign.review?.decision !== 'approved'
  ) {
    return false
  }

  const durationMinutes =
    normalizeDurationMinutes(
      campaign.durationMinutes,
    )

  const placementSelections =
    normalizePlacementSelections({
      placements:
        campaign.placements || [],
      placementSelections:
        campaign.placementSelections || [],
    })

  const bookedStartsAt =
    campaign.scheduledStartsAt
      ? new Date(campaign.scheduledStartsAt)
      : null

  const bookedEndsAt =
    campaign.scheduledEndsAt
      ? new Date(campaign.scheduledEndsAt)
      : null

  const hasFutureBookedWindow =
    bookedStartsAt &&
    bookedEndsAt &&
    bookedStartsAt > now &&
    bookedEndsAt > bookedStartsAt

  let activationStartsAt =
    hasFutureBookedWindow
      ? bookedStartsAt
      : null

  let activationEndsAt =
    hasFutureBookedWindow
      ? bookedEndsAt
      : null

  if (!activationStartsAt || !activationEndsAt) {
    const bookingWindow =
      await findCommonPlacementWindow({
        placementSelections,
        durationMinutes,
        requestedStartAt: now,
        excludeCampaignId:
          campaign._id,
      })

    activationStartsAt =
      bookingWindow.scheduledStartsAt
    activationEndsAt =
      bookingWindow.scheduledEndsAt

    campaign.scheduledStartsAt =
      activationStartsAt
    campaign.scheduledEndsAt =
      activationEndsAt
  }

  campaign.durationMinutes =
    durationMinutes
  campaign.placementSelections =
    placementSelections
  campaign.status =
    'active'
  campaign.activatedAt =
    now
  campaign.startsAt =
    activationStartsAt
  campaign.endsAt =
    activationEndsAt
  campaign.pausedAt =
    null

  await campaign.save()

  return true
}

async function activateApprovedRetailMediaCampaignsForServing({
  placement,
  slotKey = '',
  marketCode,
  now = new Date(),
}) {
  const filter = {
    status: 'approved',
    'payment.status': 'paid',
    'review.decision': 'approved',
    placements: placement,
    marketCodes: marketCode,
  }

  if (slotKey) {
    filter.placementSelections = {
      $elemMatch: {
        placement,
        slotKey,
      },
    }
  }

  const campaigns =
    await Campaign.find(filter)
      .sort({
        scheduledStartsAt: 1,
        createdAt: 1,
      })
      .limit(100)

  for (const campaign of campaigns) {
    try {
      await activateApprovedRetailMediaCampaign(
        campaign,
        { now },
      )
    } catch {
      // Public ad delivery must not fail because one legacy approved
      // campaign cannot be normalized. Other eligible campaigns can
      // still be considered by the serving query below.
    }
  }
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

function campaignNotificationId(campaign) {
  return String(
    campaign?._id ||
      campaign?.id ||
      '',
  ).trim()
}

async function notifyCampaignReadyForAdminReviewBestEffort(campaign) {
  const campaignId = campaignNotificationId(campaign)

  if (
    !campaignId ||
    campaign?.status !== 'pending_review' ||
    campaign?.payment?.status !== 'paid'
  ) {
    return []
  }

  const title = String(campaign?.title || 'Sponsored campaign').trim()

  return notifyActiveSuperAdminsBestEffort({
    triggerType: 'retail_media_campaign_review_requested',
    reasonCode: 'retail_media_campaign_review_requested',
    explanation: `${title} is paid and ready for Super Admin review. Open the campaign to approve or reject it.`,
    relatedEntityType: 'retail_media_campaign',
    relatedEntityId: campaignId,
    sourceDomain: 'retail_media',
    sourceVersion: 'm21-v2',
    dedupeScope: `retail-media-review-ready:${campaignId}`,
  })
}

async function notifyHostCampaignReviewResultBestEffort(campaign) {
  const campaignId = campaignNotificationId(campaign)
  const hostUserId = campaign?.createdByUserId
  const decision = String(campaign?.review?.decision || '').trim()

  if (
    !campaignId ||
    !hostUserId ||
    !['approved', 'rejected'].includes(decision)
  ) {
    return null
  }

  const title = String(campaign?.title || 'Sponsored campaign').trim()
  const approved = decision === 'approved'
  const reviewNote = String(campaign?.review?.reason || '').trim()

  return createNotificationIntentBestEffort({
    userId: hostUserId,
    category: 'operations',
    triggerType: 'retail_media_campaign_review_result',
    reasonCode: approved
      ? 'retail_media_campaign_approved'
      : 'retail_media_campaign_rejected',
    explanation: approved
      ? `${title} was approved by Super Admin. EPANTRY will publish it automatically in its booked ad position and stop it when the purchased duration ends.`
      : `${title} was not approved.${reviewNote ? ` Review note: ${reviewNote}` : ' Open your campaign to review the decision.'}`,
    relatedEntityType: 'retail_media_campaign',
    relatedEntityId: campaignId,
    sourceDomain: 'retail_media',
    sourceVersion: 'm21-v2',
    actions: ['dismiss'],
    requestedChannels: ['in_app'],
    dedupeKey: `retail-media-review-result:${campaignId}:${decision}`,
  })
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

    placementSelections:
      item.placementSelections || [],

    durationMinutes:
      normalizeDurationMinutes(
        item.durationMinutes,
      ),

    startsAt:
      item.startsAt || null,

    endsAt:
      item.endsAt || null,

    scheduledStartsAt:
      item.scheduledStartsAt || null,

    scheduledEndsAt:
      item.scheduledEndsAt || null,

    reservationHeldUntil:
      item.reservationHeldUntil || null,

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
              item.durationMinutes,
            ),
        ),

      placementCharges:
        item.payment?.placementCharges?.length
          ? item.payment.placementCharges
          : placementPricingRows(
              item.placements || [],
              item.durationMinutes,
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

    slotKey:
      item.slotKey || '',

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

  const durationMinutes =
    normalizeDurationMinutes(
      input.durationMinutes,
    )

  const placementSelections =
    normalizePlacementSelections({
      placements,
      placementSelections:
        input.placementSelections || [],
    })

  const bookingWindow =
    await findCommonPlacementWindow({
      placementSelections,
      durationMinutes,
      requestedStartAt:
        input.startsAt ||
        brief.startsAt ||
        null,
    })

  const paymentPlacementCharges =
    placementPricingRows(
      placements,
      durationMinutes,
    )

  const paymentRequiredAmountMinor =
    placementPricingTotalMinor(
      placements,
      durationMinutes,
    )

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

      placementSelections,

      durationMinutes,

      startsAt:
        null,

      endsAt:
        null,

      scheduledStartsAt:
        bookingWindow.scheduledStartsAt,

      scheduledEndsAt:
        bookingWindow.scheduledEndsAt,

      reservationHeldUntil:
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

        imageUrl:
          input.imageUrl || '',
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

export async function updateHostRetailMediaCampaign({
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

  await endExpiredRetailMediaCampaigns()

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
    ['active', 'paused', 'ended'].includes(
      campaign.status,
    )
  ) {
    throw new ApiError(
      409,
      'Running or ended campaigns cannot be edited. Pause is for delivery control only; create a new campaign for a new run.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_CAMPAIGN_EDIT_LOCKED',
        },
      ],
    )
  }

  const placements =
    [...new Set(input.placements || [])]

  const durationMinutes =
    normalizeDurationMinutes(
      input.durationMinutes,
    )

  const placementSelections =
    normalizePlacementSelections({
      placements,
      placementSelections:
        input.placementSelections || [],
    })

  const currentSelections =
    normalizePlacementSelections({
      placements:
        campaign.placements || [],
      placementSelections:
        campaign.placementSelections || [],
    })

  const normalizeSelectionFingerprint =
    (selections) =>
      JSON.stringify(
        [...selections]
          .map((selection) => ({
            placement:
              selection.placement,
            slotKey:
              selection.slotKey,
          }))
          .sort((left, right) =>
            `${left.placement}:${left.slotKey}`.localeCompare(
              `${right.placement}:${right.slotKey}`,
            ),
          ),
      )

  const requestedStartsAt =
    input.startsAt
      ? new Date(input.startsAt)
      : null

  const currentScheduledStartsAt =
    campaign.scheduledStartsAt
      ? new Date(campaign.scheduledStartsAt)
      : null

  const placementChanged =
    normalizeSelectionFingerprint(
      placementSelections,
    ) !==
    normalizeSelectionFingerprint(
      currentSelections,
    )

  const durationChanged =
    durationMinutes !==
    normalizeDurationMinutes(
      campaign.durationMinutes,
    )

  const requestedStartChanged =
    Boolean(requestedStartsAt) !==
      Boolean(currentScheduledStartsAt) ||
    (
      requestedStartsAt &&
      currentScheduledStartsAt &&
      requestedStartsAt.getTime() !==
        currentScheduledStartsAt.getTime()
    )

  const paidCampaign =
    campaign.payment?.status === 'paid'

  const legacyPaidBookingIncomplete =
    paidCampaign &&
    (campaign.placementSelections || []).length <
      (campaign.placements || []).length

  const placementCategoryChanged =
    JSON.stringify(
      [...placements].sort(),
    ) !==
    JSON.stringify(
      [...(campaign.placements || [])].sort(),
    )

  const bookingChanged =
    legacyPaidBookingIncomplete ||
    placementChanged ||
    durationChanged ||
    requestedStartChanged

  if (
    paidCampaign &&
    bookingChanged &&
    (
      !legacyPaidBookingIncomplete ||
      placementCategoryChanged ||
      durationChanged
    )
  ) {
    throw new ApiError(
      409,
      'Page position, duration and booked start are locked after payment. You can still edit the ad image, headline, message and landing destination.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PAID_BOOKING_LOCKED',
        },
      ],
    )
  }

  const contextualTags =
    uniqueTags(
      input.contextualTags,
    )

  assertNoSensitiveTargeting(
    contextualTags,
  )

  if (bookingChanged) {
    const bookingWindow =
      await findCommonPlacementWindow({
        placementSelections,
        durationMinutes,
        requestedStartAt:
          requestedStartsAt,
        excludeCampaignId:
          campaign._id,
      })

    campaign.placements =
      placements
    campaign.placementSelections =
      placementSelections
    campaign.durationMinutes =
      durationMinutes
    campaign.scheduledStartsAt =
      bookingWindow.scheduledStartsAt
    campaign.scheduledEndsAt =
      bookingWindow.scheduledEndsAt
    campaign.startsAt =
      null
    campaign.endsAt =
      null
    campaign.reservationHeldUntil =
      null

    const requiredAmountMinor =
      placementPricingTotalMinor(
        placements,
        durationMinutes,
      )

    campaign.budget.lifetimeAmountMinor =
      requiredAmountMinor

    if (!paidCampaign) {
      campaign.payment.status =
        'unpaid'
      campaign.payment.providerMode =
        'unknown'
      campaign.payment.requiredAmountMinor =
        requiredAmountMinor
      campaign.payment.placementCharges =
        placementPricingRows(
          placements,
          durationMinutes,
        )
      campaign.payment.providerOrderId =
        ''
      campaign.payment.providerPaymentId =
        ''
      campaign.payment.paidAt =
        null
    }
  }

  campaign.contextualTags =
    contextualTags
  campaign.frequencyCapPerContext =
    input.frequencyCapPerContext
  campaign.creative = {
    headline:
      input.headline,
    body:
      input.body,
    landingRef:
      input.landingRef,
    sponsorLabel:
      input.sponsorLabel,
    imageUrl:
      input.imageUrl || '',
  }

  campaign.status =
    'pending_review'
  campaign.review = {
    decision:
      'pending',
    reason:
      '',
    evidenceRefs:
      [],
    reviewedByUserId:
      null,
    reviewedAt:
      null,
  }

  await campaign.save()

  if (campaign.payment?.status === 'paid') {
    await notifyCampaignReadyForAdminReviewBestEffort(
      campaign,
    )
  }

  return {
    campaign:
      serializeCampaign(
        campaign,
      ),

    bookingLocked:
      campaign.payment?.status === 'paid',
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

  await endExpiredRetailMediaCampaigns()

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

  await Promise.all(
    campaigns
      .filter(
        (campaign) =>
          campaign.status === 'pending_review' &&
          campaign.payment?.status === 'paid',
      )
      .map(
        (campaign) =>
          notifyCampaignReadyForAdminReviewBestEffort(
            campaign,
          ),
      ),
  )

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
      'fixed_placement_duration_test_fee',

    baseDurationMinutes:
      RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,

    durationOptions:
      RETAIL_MEDIA_DURATION_OPTIONS.map((option) => ({
        ...option,
        priceMultiplier:
          option.durationMinutes /
          RETAIL_MEDIA_DEFAULT_DURATION_MINUTES,
      })),

    placementPricing:
      Object.entries(
        RETAIL_MEDIA_PLACEMENT_PRICING_MINOR,
      ).map(
        ([placement, amountMinor]) => ({
          placement,
          amountMinor,
        }),
      ),

    placementSlots:
      RETAIL_MEDIA_PLACEMENT_SLOTS,

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

export async function getHostRetailMediaPlacementAvailability({
  placement,
  slotKey,
  durationMinutes,
  requestedStartAt = null,
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

  return {
    availability:
      await findSlotAvailability({
        placement,
        slotKey,
        durationMinutes,
        requestedStartAt,
      }),
  }
}

export async function createRetailMediaCampaignImageUploadIntent({
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

  try {
    return {
      uploadIntent:
        createRetailMediaImageUploadIntent({
          userId:
            actorId(actorUser),
        }),
    }
  } catch (error) {
    throw new ApiError(
      503,
      'Campaign image upload is temporarily unavailable.',
      [
        {
          code:
            error?.code ||
            'M21_RETAIL_MEDIA_IMAGE_PROVIDER_UNAVAILABLE',
        },
      ],
    )
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
          campaign.durationMinutes,
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

  const placementSelections =
    normalizePlacementSelections({
      placements:
        campaign.placements,
      placementSelections:
        campaign.placementSelections || [],
    })

  const scheduledStartsAt =
    campaign.scheduledStartsAt ||
    new Date()

  const scheduledEndsAt =
    campaign.scheduledEndsAt ||
    new Date(
      new Date(scheduledStartsAt).getTime() +
        normalizeDurationMinutes(campaign.durationMinutes) * 60 * 1000,
    )

  const availabilityChecks =
    await Promise.all(
      placementSelections.map((selection) =>
        findSlotAvailability({
          placement:
            selection.placement,
          slotKey:
            selection.slotKey,
          durationMinutes:
            campaign.durationMinutes,
          requestedStartAt:
            scheduledStartsAt,
          excludeCampaignId:
            campaign._id,
        }),
      ),
    )

  const blockedPosition =
    availabilityChecks.find(
      (item) => !item.available,
    )

  if (blockedPosition) {
    throw new ApiError(
      409,
      `${blockedPosition.slotLabel} is already booked for this time. It is next available from ${new Date(
        blockedPosition.nextAvailableAt,
      ).toISOString()}. Choose that time or another position before payment.`,
      [
        {
          code:
            'M21_RETAIL_MEDIA_POSITION_NO_LONGER_AVAILABLE',
          placement:
            blockedPosition.placement,
          slotKey:
            blockedPosition.slotKey,
          nextAvailableAt:
            blockedPosition.nextAvailableAt,
        },
      ],
    )
  }

  campaign.placementSelections =
    placementSelections
  campaign.scheduledStartsAt =
    scheduledStartsAt
  campaign.scheduledEndsAt =
    scheduledEndsAt
  campaign.reservationHeldUntil =
    new Date(
      Date.now() +
        RETAIL_MEDIA_RESERVATION_HOLD_MINUTES * 60 * 1000,
    )

  if (
    campaign.payment?.status ===
      'initiated' &&
    campaign.payment?.providerOrderId
  ) {
    await campaign.save()
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
            campaign.durationMinutes,
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
    await notifyCampaignReadyForAdminReviewBestEffort(
      campaign,
    )

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
  campaign.reservationHeldUntil =
    null

  await campaign.save()

  await notifyCampaignReadyForAdminReviewBestEffort(
    campaign,
  )

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

  await endExpiredRetailMediaCampaigns()

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

    const durationMinutes =
      normalizeDurationMinutes(
        campaign.durationMinutes,
      )

    const bookedStartsAt =
      campaign.scheduledStartsAt
        ? new Date(campaign.scheduledStartsAt)
        : null

    const bookedEndsAt =
      campaign.scheduledEndsAt
        ? new Date(campaign.scheduledEndsAt)
        : null

    let activationStartsAt =
      bookedStartsAt && bookedStartsAt > now
        ? bookedStartsAt
        : now

    let activationEndsAt =
      bookedStartsAt &&
      bookedStartsAt > now &&
      bookedEndsAt
        ? bookedEndsAt
        : null

    if (!activationEndsAt) {
      const placementSelections =
        normalizePlacementSelections({
          placements:
            campaign.placements,
          placementSelections:
            campaign.placementSelections || [],
        })

      const bookingWindow =
        await findCommonPlacementWindow({
          placementSelections,
          durationMinutes,
          requestedStartAt: now,
          excludeCampaignId:
            campaign._id,
        })

      activationStartsAt =
        bookingWindow.scheduledStartsAt
      activationEndsAt =
        bookingWindow.scheduledEndsAt
      campaign.placementSelections =
        placementSelections
      campaign.scheduledStartsAt =
        activationStartsAt
      campaign.scheduledEndsAt =
        activationEndsAt
    }

    campaign.durationMinutes =
      durationMinutes

    campaign.status =
      'active'

    campaign.activatedAt =
      now

    campaign.startsAt =
      activationStartsAt

    campaign.endsAt =
      activationEndsAt ||
      new Date(
        activationStartsAt.getTime() +
          durationMinutes * 60 * 1000,
      )

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
        'This Retail Media Campaign has reached its selected duration and cannot be resumed.',
        [
          {
            code:
              'M21_RETAIL_MEDIA_CAMPAIGN_DURATION_ENDED',
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

  await endExpiredRetailMediaCampaigns()

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

  const organizationIds =
    [
      ...new Set(
        campaigns
          .map((campaign) => stringId(campaign.organizationId))
          .filter(Boolean),
      ),
    ]

  const brandIds =
    [
      ...new Set(
        campaigns
          .map((campaign) => stringId(campaign.brandId))
          .filter(Boolean),
      ),
    ]

  const [organizations, brands] =
    await Promise.all([
      organizationIds.length
        ? MarketplaceOrganization.find({
            _id: {
              $in: organizationIds,
            },
          })
            .select('_id displayName organizationType status')
            .lean()
        : [],

      brandIds.length
        ? Brand.find({
            _id: {
              $in: brandIds,
            },
          })
            .select('_id name status')
            .lean()
        : [],
    ])

  const organizationById =
    new Map(
      organizations.map((organization) => [
        stringId(organization._id),
        organization,
      ]),
    )

  const brandById =
    new Map(
      brands.map((brand) => [
        stringId(brand._id),
        brand,
      ]),
    )

  return {
    campaigns:
      campaigns.map((campaign) => {
        const serialized =
          serializeCampaign(campaign)

        const organization =
          organizationById.get(serialized.organizationId) ||
          null

        const brand =
          brandById.get(serialized.brandId) ||
          null

        return {
          ...serialized,
          organizationName:
            organization?.displayName ||
            'Host business',
          organizationType:
            organization?.organizationType ||
            '',
          organizationStatus:
            organization?.status ||
            '',
          brandName:
            brand?.name ||
            '',
        }
      }),
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

  if (input.decision === 'approve') {
    await activateApprovedRetailMediaCampaign(
      campaign,
      {
        now: campaign.review.reviewedAt,
      },
    )
  } else {
    await campaign.save()
  }

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

  await notifyHostCampaignReviewResultBestEffort(
    campaign,
  )

  return {
    campaign:
      serializeCampaign(
        campaign,
      ),
  }
}

function activeCampaignFilter({
  placement,
  slotKey = '',
  marketCode,
  now,
}) {
  const filter = {
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

  if (slotKey) {
    filter.placementSelections = {
      $elemMatch: {
        placement,
        slotKey,
      },
    }
  }

  return filter
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
  slotKey = '',
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
      slotKey,
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

function publicCampaignProductPrice({
  priceRule,
}) {
  if (!priceRule?.listPrice) {
    return null
  }

  const listAmountMinor =
    Number(
      priceRule.listPrice.amountMinor,
    )

  const saleAmountMinor =
    priceRule.salePrice?.amountMinor === null ||
    priceRule.salePrice?.amountMinor === undefined
      ? null
      : Number(
          priceRule.salePrice.amountMinor,
        )

  const effectiveAmountMinor =
    saleAmountMinor ??
    listAmountMinor

  const discountPercent =
    saleAmountMinor !== null &&
    listAmountMinor > 0 &&
    saleAmountMinor < listAmountMinor
      ? Math.round(
          (
            (
              listAmountMinor -
              saleAmountMinor
            ) /
            listAmountMinor
          ) *
            100,
        )
      : 0

  return {
    listAmountMinor,
    saleAmountMinor,
    effectiveAmountMinor,
    currency:
      priceRule.salePrice?.currency ||
      priceRule.listPrice.currency ||
      'INR',
    discountPercent,
  }
}

async function listPublicCampaignProducts({
  campaign,
  now,
}) {
  const offers =
    await HostOffer.find({
      organizationId:
        campaign.organizationId,
      status:
        'active',
    })
      .sort({
        updatedAt:
          -1,
        _id:
          -1,
      })
      .lean()

  if (!offers.length) {
    return []
  }

  const offerIds =
    offers.map(
      (offer) =>
        offer._id,
    )

  const packIds =
    offers.map(
      (offer) =>
        offer.packId,
    )

  const [
    priceRules,
    packs,
    versions,
  ] =
    await Promise.all([
      PriceRule.find({
        organizationId:
          campaign.organizationId,
        offerId: {
          $in:
            offerIds,
        },
        status: {
          $ne:
            'disabled',
        },
        effectiveFrom: {
          $lte:
            now,
        },
        $or: [
          {
            effectiveTo:
              null,
          },
          {
            effectiveTo: {
              $gt:
                now,
            },
          },
        ],
      })
        .sort({
          effectiveFrom:
            -1,
          _id:
            -1,
        })
        .lean(),

      Pack.find({
        _id: {
          $in:
            packIds,
        },
        status:
          'active',
      })
        .select(
          '_id variantId packKey displayName packType',
        )
        .lean(),

      ProductVersion.find({
        packId: {
          $in:
            packIds,
        },
        publicationStatus:
          'published',
        $and: [
          {
            $or: [
              {
                effectiveFrom:
                  null,
              },
              {
                effectiveFrom: {
                  $lte:
                    now,
                },
              },
            ],
          },
          {
            $or: [
              {
                effectiveTo:
                  null,
              },
              {
                effectiveTo: {
                  $gt:
                    now,
                },
              },
            ],
          },
        ],
      })
        .select(
          '_id packId variantId version displayName netQuantity images',
        )
        .sort({
          packId:
            1,
          version:
            -1,
          _id:
            -1,
        })
        .lean(),
    ])

  const priceRuleByOfferId =
    new Map()

  for (const rule of priceRules) {
    const key =
      stringId(
        rule.offerId,
      )

    if (
      key &&
      !priceRuleByOfferId.has(key)
    ) {
      priceRuleByOfferId.set(
        key,
        rule,
      )
    }
  }

  const packById =
    new Map(
      packs.map(
        (pack) => [
          stringId(pack._id),
          pack,
        ],
      ),
    )

  const versionByPackId =
    new Map()

  for (const version of versions) {
    const key =
      stringId(
        version.packId,
      )

    if (
      key &&
      !versionByPackId.has(key)
    ) {
      versionByPackId.set(
        key,
        version,
      )
    }
  }

  const variantIds =
    [
      ...new Set(
        packs
          .map(
            (pack) =>
              stringId(
                pack.variantId,
              ),
          )
          .filter(Boolean),
      ),
    ]

  const variants =
    variantIds.length
      ? await ProductVariant.find({
          _id: {
            $in:
              variantIds,
          },
          status:
            'active',
        })
          .select(
            '_id familyId variantKey canonicalName',
          )
          .lean()
      : []

  const variantById =
    new Map(
      variants.map(
        (variant) => [
          stringId(variant._id),
          variant,
        ],
      ),
    )

  const familyIds =
    [
      ...new Set(
        variants
          .map(
            (variant) =>
              stringId(
                variant.familyId,
              ),
          )
          .filter(Boolean),
      ),
    ]

  const families =
    familyIds.length
      ? await ProductFamily.find({
          _id: {
            $in:
              familyIds,
          },
          status:
            'active',
        })
          .select(
            '_id brandId slug canonicalName',
          )
          .lean()
      : []

  const familyById =
    new Map(
      families.map(
        (family) => [
          stringId(family._id),
          family,
        ],
      ),
    )

  const campaignBrandId =
    stringId(
      campaign.brandId,
    )

  const products = []

  for (const offer of offers) {
    const offerId =
      stringId(
        offer._id,
      )
    const packId =
      stringId(
        offer.packId,
      )
    const pack =
      packById.get(
        packId,
      )
    const version =
      versionByPackId.get(
        packId,
      )
    const priceRule =
      priceRuleByOfferId.get(
        offerId,
      )

    if (
      !pack ||
      !version ||
      !priceRule
    ) {
      continue
    }

    const variant =
      variantById.get(
        stringId(
          pack.variantId ||
            version.variantId,
        ),
      )

    const family =
      variant
        ? familyById.get(
            stringId(
              variant.familyId,
            ),
          )
        : null

    if (
      campaignBrandId &&
      stringId(
        family?.brandId,
      ) !== campaignBrandId
    ) {
      continue
    }

    const sortedImages =
      Array.isArray(
        version.images,
      )
        ? [
            ...version.images,
          ].sort(
            (left, right) =>
              Number(
                left?.sortOrder ||
                  0,
              ) -
              Number(
                right?.sortOrder ||
                  0,
              ),
          )
        : []

    const image =
      sortedImages.find(
        (item) =>
          Boolean(
            String(
              item?.url ||
                '',
            ).trim(),
          ),
      )

    const price =
      publicCampaignProductPrice({
        priceRule,
      })

    if (!price) {
      continue
    }

    products.push({
      offerId,
      packId,
      productVersionId:
        stringId(
          version._id,
        ),
      displayName:
        version.displayName ||
        pack.displayName ||
        family?.canonicalName ||
        'Product',
      slug:
        buildPublicProductSlug({
          familySlug:
            family?.slug,
          variantKey:
            variant?.variantKey,
          packKey:
            pack.packKey,
        }),
      image: image
        ? {
            url:
              image.url ||
              '',
            alt:
              image.alt ||
              version.displayName ||
              '',
          }
        : null,
      netQuantity:
        version.netQuantity ||
        null,
      price,
    })
  }

  const imageReadyProducts =
    await Promise.all(
      products.map(
        async (product) => {
          if (
            product?.image?.url ||
            !product?.slug
          ) {
            return product
          }

          try {
            const publicProduct =
              await getPublicProductBySlug(
                product.slug,
              )

            if (
              publicProduct?.image?.url
            ) {
              return {
                ...product,
                image: {
                  url:
                    publicProduct.image.url,
                  alt:
                    publicProduct.image.alt ||
                    product.displayName ||
                    '',
                },
              }
            }
          } catch {
            // Keep the promotion usable when a governed image is unavailable.
          }

          return product
        },
      ),
    )

  return imageReadyProducts
}

export async function getPublicRetailMediaPromotion({
  campaignId,
}) {
  await requireRetailMediaFeature()

  const now =
    new Date()

  await endExpiredRetailMediaCampaigns(
    now,
  )

  const campaign =
    await Campaign.findOne({
      _id:
        campaignId,
      status:
        'active',
      'payment.status':
        'paid',
      'review.decision':
        'approved',
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
    }).lean()

  if (!campaign) {
    throw new ApiError(
      404,
      'This promotion is not currently available.',
      [
        {
          code:
            'M21_RETAIL_MEDIA_PUBLIC_PROMOTION_NOT_AVAILABLE',
        },
      ],
    )
  }

  const [
    organization,
    brand,
    products,
  ] =
    await Promise.all([
      MarketplaceOrganization.findById(
        campaign.organizationId,
      )
        .select(
          '_id displayName slug organizationType status',
        )
        .lean(),

      campaign.brandId
        ? Brand.findById(
            campaign.brandId,
          )
            .select(
              '_id name slug logoUrl',
            )
            .lean()
        : null,

      listPublicCampaignProducts({
        campaign,
        now,
      }),
    ])

  const sponsorName =
    String(
      brand?.name ||
        organization?.displayName ||
        campaign.title ||
        'EPANTRY partner',
    ).trim()

  return {
    promotion: {
      id:
        stringId(
          campaign._id,
        ),
      title:
        campaign.title ||
        '',
      objective:
        campaign.objective ||
        'promotion',
      sponsor: {
        organizationId:
          stringId(
            campaign.organizationId,
          ),
        brandId:
          stringId(
            campaign.brandId,
          ),
        name:
          sponsorName,
        logoUrl:
          brand?.logoUrl ||
          '',
      },
      creative: {
        headline:
          campaign.creative?.headline ||
          '',
        body:
          campaign.creative?.body ||
          '',
        imageUrl:
          campaign.creative?.imageUrl ||
          '',
        sponsorLabel:
          campaign.creative?.sponsorLabel ||
          'Sponsored',
      },
      startsAt:
        campaign.startsAt ||
        null,
      endsAt:
        campaign.endsAt ||
        null,
      durationMinutes:
        normalizeDurationMinutes(
          campaign.durationMinutes,
        ),
      placements:
        campaign.placementSelections ||
        [],
    },
    products,
  }
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

      slotKey:
        input.slotKey || '',

      marketCode,

      contextTags,

      viewerKey:
        String(input.viewerKey || '').trim(),
    })

  const now =
    new Date()

  await endExpiredRetailMediaCampaigns(now)

  await activateApprovedRetailMediaCampaignsForServing({
    placement:
      input.placement,
    slotKey:
      input.slotKey || '',
    marketCode,
    now,
  })

  const campaigns =
    await Campaign.find(
      activeCampaignFilter({
        placement:
          input.placement,

        slotKey:
          input.slotKey || '',

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

        slotKey:
          input.slotKey || '',

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

        slotKey:
          input.slotKey || '',

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

      slotKey:
        input.slotKey || '',

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

  const [
    sponsorOrganization,
    sponsorBrand,
  ] =
    await Promise.all([
      MarketplaceOrganization.findById(
        selected.campaign.organizationId,
      )
        .select(
          '_id displayName',
        )
        .lean(),

      selected.campaign.brandId
        ? Brand.findById(
            selected.campaign.brandId,
          )
            .select(
              '_id name logoUrl',
            )
            .lean()
        : null,
    ])

  const sponsorName =
    String(
      sponsorBrand?.name ||
        sponsorOrganization?.displayName ||
        selected.campaign.title ||
        'EPANTRY partner',
    ).trim()

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

      sponsorName,

      sponsorLogoUrl:
        sponsorBrand?.logoUrl ||
        '',

      campaignTitle:
        selected.campaign.title ||
        '',

      objective:
        selected.campaign.objective ||
        'promotion',

      startsAt:
        selected.campaign.startsAt ||
        null,

      endsAt:
        selected.campaign.endsAt ||
        null,

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

      imageUrl:
        selected.campaign
          .creative
          ?.imageUrl ||
        '',

      placement:
        input.placement,

      slotKey:
        input.slotKey || '',

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