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

  if (!flag) {
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

  return flag
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