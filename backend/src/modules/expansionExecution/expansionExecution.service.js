import crypto from 'crypto'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  AdminFeatureFlag,
} from '../adminGovernance/adminGovernance.models.js'

import {
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  CourseEntitlement,
  CreatorCourse,
  CreatorProfile,
} from '../community/community.models.js'

import {
  CreatorContent,
} from '../communityExpansion/communityExpansion.models.js'

import {
  createRazorpayOrder,
  getRazorpayPublicConfig,
  verifyRazorpayCheckoutSignature,
} from '../commerce/commerce.payment.provider.js'

import {
  FoodCalculation,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  listPublicEligibleOffers,
} from '../marketplace/marketplace.public.service.js'

import {
  AdDecisionLog,
  Campaign,
} from '../retailMedia/retailMedia.models.js'

import {
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  CandidateSet,
  RankingDecision,
  SearchSession,
} from '../search/search.models.js'

import {
  CreatorPaymentEvidence,
  CreatorSession,
  CreatorSessionBooking,
  CreatorSessionEvent,
  SponsoredEligibilityEvidence,
} from './expansionExecution.models.js'

export const M22_SAFE_EXPANSION_FEATURE_FLAG =
  'm22.safe_expansion_execution'

function id(value) {
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
      'Authenticated Customer identity is required.',
      [
        {
          code:
            'M22_EXPANSION_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function serializeSponsoredEvidence(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(item._id),

    searchSessionId:
      id(
        item.searchSessionId,
      ),

    campaignId:
      id(
        item.campaignId,
      ),

    placement:
      item.placement,

    marketCode:
      item.marketCode,

    promotedEntityType:
      item.promotedEntityType,

    promotedEntityId:
      item.promotedEntityId,

    canonicalVersionPublished:
      item.canonicalVersionPublished ===
      true,

    approvedFoodCalculationId:
      id(
        item.approvedFoodCalculationId,
      ),

    organicCandidatePresent:
      item.organicCandidatePresent ===
      true,

    unresolvedHardConstraintsPresent:
      item.unresolvedHardConstraintsPresent ===
      true,

    serviceabilityRequired:
      item.serviceabilityRequired ===
      true,

    serviceableOfferCount:
      item.serviceableOfferCount ||
      0,

    outcome:
      item.outcome,

    reasonCodes:
      item.reasonCodes ||
      [],

    sponsoredRankScore:
      item.sponsoredRankScore ??
      null,

    policy:
      item.policy,

    decidedAt:
      item.decidedAt,
  }
}

function serializeSession(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(item._id),

    creatorProfileId:
      id(
        item.creatorProfileId,
      ),

    courseId:
      id(
        item.courseId,
      ),

    title:
      item.title,

    summary:
      item.summary ||
      '',

    startsAt:
      item.startsAt,

    endsAt:
      item.endsAt,

    timezone:
      item.timezone,

    capacity:
      item.capacity,

    reservedSeats:
      item.reservedSeats ||
      0,

    seatsRemaining:
      Math.max(
        Number(
          item.capacity ||
          0,
        ) -
          Number(
            item.reservedSeats ||
            0,
          ),
        0,
      ),

    accessType:
      item.accessType,

    priceMinor:
      item.priceMinor ||
      0,

    currency:
      item.currency,

    cancellationCutoffMinutes:
      item.cancellationCutoffMinutes,

    commercialDisclosure:
      item.commercialDisclosure ||
      '',

    status:
      item.status,

    publishedAt:
      item.publishedAt ||
      null,

    cancelledAt:
      item.cancelledAt ||
      null,

    completedAt:
      item.completedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeBooking(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(item._id),

    sessionId:
      id(
        item.sessionId,
      ),

    courseId:
      id(
        item.courseId,
      ),

    status:
      item.status,

    accessTypeSnapshot:
      item.accessTypeSnapshot,

    amountMinor:
      item.amountMinor,

    currency:
      item.currency,

    provider:
      item.provider,

    providerOrderId:
      item.providerOrderId ||
      '',

    providerPaymentId:
      item.providerPaymentId ||
      '',

    entitlementId:
      id(
        item.entitlementId,
      ),

    confirmedAt:
      item.confirmedAt ||
      null,

    cancelledAt:
      item.cancelledAt ||
      null,

    attendedAt:
      item.attendedAt ||
      null,

    refundReviewRequiredAt:
      item.refundReviewRequiredAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

export async function requireM22SafeExpansionFeature() {
  const flag =
    await AdminFeatureFlag.findOne({
      key:
        M22_SAFE_EXPANSION_FEATURE_FLAG,

      enabled:
        true,

      environments:
        env.nodeEnv,
    }).lean()

  if (!flag) {
    throw new ApiError(
      404,
      'M22 safe expansion execution is not enabled for this environment.',
      [
        {
          code:
            'M22_SAFE_EXPANSION_FEATURE_DISABLED',

          featureFlagKey:
            M22_SAFE_EXPANSION_FEATURE_FLAG,
        },
      ],
    )
  }

  return flag
}

/*
|--------------------------------------------------------------------------
| PART 4 — Product / Recipe Sponsored Serving
|--------------------------------------------------------------------------
|
| Eligibility order is intentionally fixed:
|
| 1. M12 owned SearchSession
| 2. M12 deterministic organic CandidateSet
| 3. no unresolved M12 hard constraints
| 4. canonical version still published/current
| 5. exact M08 FoodCalculation status=approved
| 6. Product: M05 public eligible Offer/serviceability exists
| 7. only then M21 paid campaign rank is evaluated
|
| Paid rank cannot resurrect a candidate rejected by the organic safety lane.
|--------------------------------------------------------------------------
*/

async function loadOrganicEligibility({
  searchSessionId,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const session =
    await SearchSession.findOne({
      _id:
        searchSessionId,

      ownerUserId:
        userId,

      actorType:
        'customer',
    }).lean()

  if (!session) {
    throw new ApiError(
      404,
      'Owned deterministic Search session was not found.',
      [
        {
          code:
            'M22_SPONSORED_SEARCH_SESSION_NOT_FOUND',
        },
      ],
    )
  }

  const candidateSet =
    await CandidateSet.findOne({
      sessionId:
        session._id,
    })
      .sort({
        generatedAt:
          -1,
      })
      .lean()

  const rankingDecision =
    await RankingDecision.findOne({
      sessionId:
        session._id,
    })
      .sort({
        decidedAt:
          -1,
      })
      .lean()

  if (
    !candidateSet ||
    !rankingDecision
  ) {
    throw new ApiError(
      409,
      'Sponsored serving requires completed deterministic organic ranking evidence.',
      [
        {
          code:
            'M22_SPONSORED_ORGANIC_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  if (
    (
      rankingDecision
        .unresolvedConstraintCodes ||
      []
    ).length >
    0
  ) {
    return {
      session,
      candidateSet,
      rankingDecision,
      blocked:
        true,
    }
  }

  return {
    session,
    candidateSet,
    rankingDecision,
    blocked:
      false,
  }
}

async function verifyCanonicalFoodEligibility({
  entityType,
  entityId,
  pincode,
  fulfillmentType,
}) {
  const now =
    new Date()

  if (
    entityType ===
    'product'
  ) {
    const productVersion =
      await ProductVersion.findOne({
        _id:
          entityId,

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
      }).lean()

    if (!productVersion) {
      return {
        allowed:
          false,

        reasonCode:
          'PRODUCT_VERSION_NOT_PUBLISHED',

        canonicalVersionPublished:
          false,

        foodCalculation:
          null,

        serviceableOfferCount:
          0,
      }
    }

    const foodCalculation =
      await FoodCalculation.findOne({
        entityType:
          'product_version',

        entityId:
          productVersion._id,

        status:
          'approved',
      })
        .sort({
          calculationVersion:
            -1,
        })
        .lean()

    if (!foodCalculation) {
      return {
        allowed:
          false,

        reasonCode:
          'APPROVED_PRODUCT_FOOD_CALCULATION_REQUIRED',

        canonicalVersionPublished:
          true,

        foodCalculation:
          null,

        serviceableOfferCount:
          0,
      }
    }

    if (!pincode) {
      return {
        allowed:
          false,

        reasonCode:
          'PRODUCT_SERVICEABILITY_CONTEXT_REQUIRED',

        canonicalVersionPublished:
          true,

        foodCalculation,

        serviceableOfferCount:
          0,
      }
    }

    const commerce =
      await listPublicEligibleOffers({
        packId:
          productVersion.packId,

        pincode,

        fulfillmentType:
          fulfillmentType ||
          undefined,
      })

    const offers =
      commerce?.offers ||
      []

    if (!offers.length) {
      return {
        allowed:
          false,

        reasonCode:
          'NO_CURRENT_SERVICEABLE_OFFER',

        canonicalVersionPublished:
          true,

        foodCalculation,

        serviceableOfferCount:
          0,
      }
    }

    return {
      allowed:
        true,

      reasonCode:
        'PRODUCT_SAFETY_AND_SERVICEABILITY_ELIGIBLE',

      canonicalVersionPublished:
        true,

      foodCalculation,

      serviceableOfferCount:
        offers.length,
    }
  }

  const recipeVersion =
    await RecipeVersion.findOne({
      _id:
        entityId,

      status:
        'published',

      unsafeIncomplete: {
        $ne:
          true,
      },
    }).lean()

  if (!recipeVersion) {
    return {
      allowed:
        false,

      reasonCode:
        'RECIPE_VERSION_NOT_PUBLISHED',

      canonicalVersionPublished:
        false,

      foodCalculation:
        null,

      serviceableOfferCount:
        0,
    }
  }

  const foodCalculation =
    await FoodCalculation.findOne({
      entityType:
        'recipe_version',

      entityId:
        recipeVersion._id,

      status:
        'approved',
    })
      .sort({
        calculationVersion:
          -1,
      })
      .lean()

  if (!foodCalculation) {
    return {
      allowed:
        false,

      reasonCode:
        'APPROVED_RECIPE_FOOD_CALCULATION_REQUIRED',

      canonicalVersionPublished:
        true,

      foodCalculation:
        null,

      serviceableOfferCount:
        0,
    }
  }

  return {
    allowed:
      true,

    reasonCode:
      'RECIPE_SAFETY_ELIGIBLE',

    canonicalVersionPublished:
      true,

    foodCalculation,

    serviceableOfferCount:
      0,
  }
}

function paidRankScore(campaign) {
  const quality =
    Math.max(
      0,

      Math.min(
        Number(
          campaign.qualityScore ||
          0,
        ),
        100,
      ),
    ) /
    100

  const bid =
    Math.max(
      0,

      Math.min(
        Number(
          campaign.bidMinor ||
          0,
        ),
        1000000,
      ),
    ) /
    1000000

  return Number(
    (
      quality *
        0.85 +
      bid *
        0.15
    ).toFixed(
      6,
    ),
  )
}

async function appendAdDecision({
  campaign,
  input,
  outcome,
  reasonCodes,
  sponsoredRankScore,
}) {
  return AdDecisionLog.create({
    campaignId:
      campaign?._id ||
      null,

    organizationId:
      campaign?.organizationId ||
      null,

    placement:
      input.placement,

    marketCode:
      input.marketCode,

    contextFingerprint:
      `m22-search:${input.searchSessionId}`,

    promotedEntityType:
      campaign?.promotedEntityType ||
      'generic',

    promotedEntityId:
      campaign?.promotedEntityId ||
      '',

    outcome,

    reasonCodes,

    sponsorLabel:
      campaign?.creative?.sponsorLabel ||
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
}

export async function decideSafeSponsoredPlacement({
  input,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const organic =
    await loadOrganicEligibility({
      searchSessionId:
        input.searchSessionId,

      actorUser,
    })

  const userId =
    actorId(
      actorUser,
    )

  if (organic.blocked) {
    const evidence =
      await SponsoredEligibilityEvidence.create({
        customerUserId:
          userId,

        searchSessionId:
          organic.session._id,

        candidateSetId:
          organic.candidateSet._id,

        rankingDecisionId:
          organic.rankingDecision._id,

        placement:
          input.placement,

        marketCode:
          input.marketCode,

        outcome:
          'suppressed',

        reasonCodes: [
          'ORGANIC_HARD_CONSTRAINTS_UNRESOLVED',
        ],

        unresolvedHardConstraintsPresent:
          true,

        policy: {
          safetyEvaluatedBeforePaidRanking:
            true,

          organicRankingMutated:
            false,

          clientSafetyAssertionTrusted:
            false,
        },
      })

    await appendAdDecision({
      campaign:
        null,

      input,

      outcome:
        'suppressed',

      reasonCodes: [
        'ORGANIC_HARD_CONSTRAINTS_UNRESOLVED',
      ],

      sponsoredRankScore:
        null,
    })

    return {
      sponsored:
        null,

      eligibilityEvidence:
        serializeSponsoredEvidence(
          evidence,
        ),

      policy: {
        hardSafetyEvaluatedBeforePaidRank:
          true,

        organicRankingMutated:
          false,

        unsafeCandidateCanBeResurrectedByBid:
          false,
      },
    }
  }

  const organicCandidateKeys =
    new Set(
      (
        organic.candidateSet
          .candidates ||
        []
      )
        .filter(
          (
            candidate,
          ) =>
            [
              'product',
              'recipe',
            ].includes(
              candidate.candidateType,
            ),
        )
        .map(
          (
            candidate,
          ) =>
            `${candidate.candidateType}:${candidate.candidateId}`,
        ),
    )

  const now =
    new Date()

  const campaigns =
    await Campaign.find({
      status:
        'active',

      placements:
        input.placement,

      marketCodes:
        input.marketCode,

      promotedEntityType: {
        $in: [
          'product',
          'recipe',
        ],
      },

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
    })
      .sort({
        qualityScore:
          -1,

        createdAt:
          1,
      })
      .limit(
        100,
      )
      .lean()

  const eligible = []
  const suppressedEvidence = []

  for (
    const campaign
    of campaigns
  ) {
    const key =
      `${campaign.promotedEntityType}:${campaign.promotedEntityId}`

    if (
      !organicCandidateKeys.has(
        key,
      )
    ) {
      const evidence =
        await SponsoredEligibilityEvidence.create({
          customerUserId:
            userId,

          searchSessionId:
            organic.session._id,

          candidateSetId:
            organic.candidateSet._id,

          rankingDecisionId:
            organic.rankingDecision._id,

          campaignId:
            campaign._id,

          placement:
            input.placement,

          marketCode:
            input.marketCode,

          promotedEntityType:
            campaign.promotedEntityType,

          promotedEntityId:
            campaign.promotedEntityId,

          organicCandidatePresent:
            false,

          unresolvedHardConstraintsPresent:
            false,

          serviceabilityRequired:
            campaign.promotedEntityType ===
            'product',

          outcome:
            'suppressed',

          reasonCodes: [
            'NOT_AN_ORGANICALLY_ELIGIBLE_CANDIDATE',
          ],

          policy: {
            safetyEvaluatedBeforePaidRanking:
              true,

            organicRankingMutated:
              false,

            clientSafetyAssertionTrusted:
              false,
          },
        })

      suppressedEvidence.push(
        serializeSponsoredEvidence(
          evidence,
        ),
      )

      continue
    }

    const canonical =
      await verifyCanonicalFoodEligibility({
        entityType:
          campaign.promotedEntityType,

        entityId:
          campaign.promotedEntityId,

        pincode:
          input.pincode,

        fulfillmentType:
          input.fulfillmentType,
      })

    if (!canonical.allowed) {
      const evidence =
        await SponsoredEligibilityEvidence.create({
          customerUserId:
            userId,

          searchSessionId:
            organic.session._id,

          candidateSetId:
            organic.candidateSet._id,

          rankingDecisionId:
            organic.rankingDecision._id,

          campaignId:
            campaign._id,

          placement:
            input.placement,

          marketCode:
            input.marketCode,

          promotedEntityType:
            campaign.promotedEntityType,

          promotedEntityId:
            campaign.promotedEntityId,

          canonicalVersionPublished:
            canonical.canonicalVersionPublished,

          approvedFoodCalculationId:
            canonical.foodCalculation?._id ||
            null,

          organicCandidatePresent:
            true,

          unresolvedHardConstraintsPresent:
            false,

          serviceabilityRequired:
            campaign.promotedEntityType ===
            'product',

          serviceableOfferCount:
            canonical.serviceableOfferCount,

          outcome:
            'suppressed',

          reasonCodes: [
            canonical.reasonCode,
          ],

          policy: {
            safetyEvaluatedBeforePaidRanking:
              true,

            organicRankingMutated:
              false,

            clientSafetyAssertionTrusted:
              false,
          },
        })

      suppressedEvidence.push(
        serializeSponsoredEvidence(
          evidence,
        ),
      )

      continue
    }

    eligible.push({
      campaign,
      canonical,

      score:
        paidRankScore(
          campaign,
        ),
    })
  }

  eligible.sort(
    (
      left,
      right,
    ) =>
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

  const winner =
    eligible[0] ||
    null

  if (!winner) {
    const evidence =
      await SponsoredEligibilityEvidence.create({
        customerUserId:
          userId,

        searchSessionId:
          organic.session._id,

        candidateSetId:
          organic.candidateSet._id,

        rankingDecisionId:
          organic.rankingDecision._id,

        placement:
          input.placement,

        marketCode:
          input.marketCode,

        outcome:
          'no_eligible_campaign',

        reasonCodes: [
          'NO_PRODUCT_OR_RECIPE_CAMPAIGN_PASSED_SAFETY_AND_ORGANIC_ELIGIBILITY',
        ],

        unresolvedHardConstraintsPresent:
          false,

        policy: {
          safetyEvaluatedBeforePaidRanking:
            true,

          organicRankingMutated:
            false,

          clientSafetyAssertionTrusted:
            false,
        },
      })

    await appendAdDecision({
      campaign:
        null,

      input,

      outcome:
        'no_eligible_campaign',

      reasonCodes: [
        'NO_PRODUCT_OR_RECIPE_CAMPAIGN_PASSED_SAFETY_AND_ORGANIC_ELIGIBILITY',
      ],

      sponsoredRankScore:
        null,
    })

    return {
      sponsored:
        null,

      eligibilityEvidence:
        serializeSponsoredEvidence(
          evidence,
        ),

      suppressedEvidence,

      policy: {
        hardSafetyEvaluatedBeforePaidRank:
          true,

        organicRankingMutated:
          false,

        unsafeCandidateCanBeResurrectedByBid:
          false,
      },
    }
  }

  const servedEvidence =
    await SponsoredEligibilityEvidence.create({
      customerUserId:
        userId,

      searchSessionId:
        organic.session._id,

      candidateSetId:
        organic.candidateSet._id,

      rankingDecisionId:
        organic.rankingDecision._id,

      campaignId:
        winner.campaign._id,

      placement:
        input.placement,

      marketCode:
        input.marketCode,

      promotedEntityType:
        winner.campaign.promotedEntityType,

      promotedEntityId:
        winner.campaign.promotedEntityId,

      canonicalVersionPublished:
        true,

      approvedFoodCalculationId:
        winner.canonical.foodCalculation._id,

      organicCandidatePresent:
        true,

      unresolvedHardConstraintsPresent:
        false,

      serviceabilityRequired:
        winner.campaign.promotedEntityType ===
        'product',

      serviceableOfferCount:
        winner.canonical.serviceableOfferCount,

      outcome:
        'served',

      reasonCodes: [
        'ORGANIC_CANDIDATE_ALREADY_ELIGIBLE',
        'APPROVED_M08_CALCULATION_PRESENT',
        winner.canonical.reasonCode,
        'PAID_RANK_EVALUATED_AFTER_HARD_SAFETY',
      ],

      sponsoredRankScore:
        winner.score,

      policy: {
        safetyEvaluatedBeforePaidRanking:
          true,

        organicRankingMutated:
          false,

        clientSafetyAssertionTrusted:
          false,
      },
    })

  await appendAdDecision({
    campaign:
      winner.campaign,

    input,

    outcome:
      'served',

    reasonCodes: [
      'ORGANIC_CANDIDATE_ALREADY_ELIGIBLE',
      'APPROVED_M08_CALCULATION_PRESENT',
      winner.canonical.reasonCode,
      'PAID_RANK_EVALUATED_AFTER_HARD_SAFETY',
    ],

    sponsoredRankScore:
      winner.score,
  })

  return {
    sponsored: {
      campaignId:
        id(
          winner.campaign._id,
        ),

      promotedEntityType:
        winner.campaign.promotedEntityType,

      promotedEntityId:
        winner.campaign.promotedEntityId,

      headline:
        winner.campaign.creative?.headline ||
        '',

      body:
        winner.campaign.creative?.body ||
        '',

      landingRef:
        winner.campaign.creative?.landingRef ||
        '',

      sponsorLabel:
        winner.campaign.creative?.sponsorLabel ||
        'Sponsored',

      whyAmISeeingThis: [
        'This is a paid placement.',

        'The same Product or Recipe already passed the deterministic organic hard-constraint lane for this Search session.',

        'Canonical publication and approved Food Intelligence were rechecked before paid ranking.',

        winner.campaign.promotedEntityType ===
        'product'
          ? 'A current serviceable Marketplace offer was required.'
          : 'No commercial serviceability claim was needed for this Recipe placement.',
      ],
    },

    eligibilityEvidence:
      serializeSponsoredEvidence(
        servedEvidence,
      ),

    suppressedEvidence,

    policy: {
      hardSafetyEvaluatedBeforePaidRank:
        true,

      organicRankingMutated:
        false,

      unsafeCandidateCanBeResurrectedByBid:
        false,

      sensitiveTargetingUsed:
        false,
    },
  }
}

/*
|--------------------------------------------------------------------------
| PART 5 — Creator / Pro Session Transactions
|--------------------------------------------------------------------------
|
| Creator remains a Customer profile, never a top-level application role.
| M15 CreatorCourse remains course truth.
| M21 CreatorContent governance must approve the course before session publish.
|--------------------------------------------------------------------------
*/

async function ownedCreatorContext(actorUser) {
  const userId =
    actorId(
      actorUser,
    )

  const profile =
    await CreatorProfile.findOne({
      userId,
    }).lean()

  return {
    userId,
    profile,
  }
}

async function appendSessionEvent({
  session,
  booking = null,
  actorType,
  actorUser = null,
  eventType,
  reason,
  metadata = {},
}) {
  return CreatorSessionEvent.create({
    sessionId:
      session._id,

    bookingId:
      booking?._id ||
      null,

    actorType,

    actorUserId:
      actorUser
        ? actorId(
            actorUser,
          )
        : null,

    eventType,

    reason,

    metadata,
  })
}

export async function listPublicCreatorSessions({
  limit = 50,
}) {
  await requireM22SafeExpansionFeature()

  const now =
    new Date()

  const sessions =
    await CreatorSession.find({
      status:
        'published',

      endsAt: {
        $gt:
          now,
      },
    })
      .sort({
        startsAt:
          1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              limit,
            ) ||
            50,
            1,
          ),
          100,
        ),
      )
      .lean()

  return {
    sessions:
      sessions.map(
        serializeSession,
      ),

    policy: {
      creatorIsApplicationRole:
        false,

      basicRecipeFactsPaywalled:
        false,

      creatorClaimIsFoodTruth:
        false,
    },
  }
}

export async function listMyCreatorSessions({
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const context =
    await ownedCreatorContext(
      actorUser,
    )

  if (!context.profile) {
    return {
      hasCreatorProfile:
        false,

      sessions:
        [],
    }
  }

  const sessions =
    await CreatorSession.find({
      ownerUserId:
        context.userId,
    })
      .sort({
        startsAt:
          -1,
      })
      .limit(
        100,
      )
      .lean()

  return {
    hasCreatorProfile:
      true,

    creatorProfileId:
      id(
        context.profile._id,
      ),

    sessions:
      sessions.map(
        serializeSession,
      ),
  }
}

export async function createCreatorSession({
  input,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const context =
    await ownedCreatorContext(
      actorUser,
    )

  if (!context.profile) {
    throw new ApiError(
      404,
      'Creator profile is required to create a class session.',
      [
        {
          code:
            'M22_CREATOR_PROFILE_REQUIRED',
        },
      ],
    )
  }

  const course =
    await CreatorCourse.findOne({
      _id:
        input.courseId,

      creatorProfileId:
        context.profile._id,

      createdByUserId:
        context.userId,

      status: {
        $ne:
          'archived',
      },
    }).lean()

  if (!course) {
    throw new ApiError(
      404,
      'Owned M15 Creator Course was not found.',
      [
        {
          code:
            'M22_CREATOR_COURSE_NOT_OWNED',
        },
      ],
    )
  }

  const session =
    await CreatorSession.create({
      creatorProfileId:
        context.profile._id,

      ownerUserId:
        context.userId,

      courseId:
        course._id,

      title:
        input.title,

      summary:
        input.summary,

      startsAt:
        input.startsAt,

      endsAt:
        input.endsAt,

      timezone:
        input.timezone,

      capacity:
        input.capacity,

      accessType:
        input.accessType,

      priceMinor:
        input.accessType ===
        'paid'
          ? input.priceMinor
          : 0,

      currency:
        input.currency,

      cancellationCutoffMinutes:
        input.cancellationCutoffMinutes,

      commercialDisclosure:
        input.commercialDisclosure,

      status:
        'draft',

      createdByUserId:
        context.userId,
    })

  await appendSessionEvent({
    session,

    actorType:
      'creator',

    actorUser,

    eventType:
      'session_created',

    reason:
      'Creator created a governed session draft linked to an existing M15 course.',

    metadata: {
      automaticPublication:
        false,

      automaticPurchase:
        false,
    },
  })

  return {
    session:
      serializeSession(
        session,
      ),

    policy: {
      courseTruthReused:
        true,

      automaticPublication:
        false,

      automaticPurchase:
        false,
    },
  }
}

export async function publishCreatorSession({
  sessionId,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const context =
    await ownedCreatorContext(
      actorUser,
    )

  if (!context.profile) {
    throw new ApiError(
      404,
      'Creator profile was not found.',
      [
        {
          code:
            'M22_CREATOR_PROFILE_REQUIRED',
        },
      ],
    )
  }

  const session =
    await CreatorSession.findOne({
      _id:
        sessionId,

      ownerUserId:
        context.userId,

      status:
        'draft',
    })

  if (!session) {
    throw new ApiError(
      404,
      'Creator session draft was not found.',
      [
        {
          code:
            'M22_CREATOR_SESSION_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    session.startsAt <=
    new Date()
  ) {
    throw new ApiError(
      409,
      'A Creator session must start in the future before publication.',
      [
        {
          code:
            'M22_CREATOR_SESSION_START_INVALID',
        },
      ],
    )
  }

  const course =
    await CreatorCourse.findOne({
      _id:
        session.courseId,

      creatorProfileId:
        context.profile._id,

      status:
        'listed',
    }).lean()

  if (!course) {
    throw new ApiError(
      409,
      'Creator session cannot publish unless the underlying M15 Course is listed.',
      [
        {
          code:
            'M22_CREATOR_COURSE_LISTED_REQUIRED',
        },
      ],
    )
  }

  const governance =
    await CreatorContent.findOne({
      contentType:
        'creator_course',

      contentId:
        course._id,

      governanceState:
        'approved',

      'rights.takedownState':
        'clear',
    }).lean()

  if (!governance) {
    throw new ApiError(
      409,
      'M21 Creator content governance approval is required before a live/class session can be published.',
      [
        {
          code:
            'M22_CREATOR_CONTENT_GOVERNANCE_REQUIRED',
        },
      ],
    )
  }

  session.status =
    'published'

  session.publishedAt =
    new Date()

  await session.save()

  await appendSessionEvent({
    session,

    actorType:
      'creator',

    actorUser,

    eventType:
      'session_published',

    reason:
      'Creator published a session after M15 course and M21 rights/governance checks.',

    metadata: {
      creatorContentGovernanceId:
        id(
          governance._id,
        ),
    },
  })

  return {
    session:
      serializeSession(
        session,
      ),
  }
}

async function activeCourseEntitlement({
  userId,
  courseId,
}) {
  const now =
    new Date()

  return CourseEntitlement.findOne({
    userId,

    courseId,

    status:
      'active',

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
}

export async function bookCreatorSession({
  sessionId,
  idempotencyKey,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const userId =
    actorId(
      actorUser,
    )

  const existing =
    await CreatorSessionBooking.findOne({
      customerUserId:
        userId,

      idempotencyKey,
    })

  if (existing) {
    return {
      booking:
        serializeBooking(
          existing,
        ),

      deduplicated:
        true,

      checkout:
        existing.status ===
        'payment_required'
          ? {
              provider:
                'razorpay',

              keyId:
                getRazorpayPublicConfig().keyId,

              providerOrderId:
                existing.providerOrderId,

              amountMinor:
                existing.amountMinor,

              currency:
                existing.currency,
            }
          : null,
    }
  }

  const session =
    await CreatorSession.findOne({
      _id:
        sessionId,

      status:
        'published',

      startsAt: {
        $gt:
          new Date(),
      },
    })

  if (!session) {
    throw new ApiError(
      404,
      'Published future Creator session was not found.',
      [
        {
          code:
            'M22_CREATOR_SESSION_NOT_BOOKABLE',
        },
      ],
    )
  }

  const priorForSession =
    await CreatorSessionBooking.findOne({
      sessionId:
        session._id,

      customerUserId:
        userId,
    })

  if (
    priorForSession &&
    ![
      'cancelled',
    ].includes(
      priorForSession.status,
    )
  ) {
    return {
      booking:
        serializeBooking(
          priorForSession,
        ),

      deduplicated:
        true,

      checkout:
        priorForSession.status ===
        'payment_required'
          ? {
              provider:
                'razorpay',

              keyId:
                getRazorpayPublicConfig().keyId,

              providerOrderId:
                priorForSession.providerOrderId,

              amountMinor:
                priorForSession.amountMinor,

              currency:
                priorForSession.currency,
            }
          : null,
    }
  }

  let entitlement =
    null

  if (
    session.accessType ===
    'entitled'
  ) {
    entitlement =
      await activeCourseEntitlement({
        userId,

        courseId:
          session.courseId,
      })

    if (!entitlement) {
      throw new ApiError(
        403,
        'An active M15 Course Entitlement is required for this session.',
        [
          {
            code:
              'M22_CREATOR_SESSION_ENTITLEMENT_REQUIRED',
          },
        ],
      )
    }
  }

  const reserved =
    await CreatorSession.findOneAndUpdate(
      {
        _id:
          session._id,

        status:
          'published',

        $expr: {
          $lt: [
            '$reservedSeats',
            '$capacity',
          ],
        },
      },
      {
        $inc: {
          reservedSeats:
            1,
        },
      },
      {
        new:
          true,
      },
    )

  if (!reserved) {
    throw new ApiError(
      409,
      'Creator session has no remaining seats.',
      [
        {
          code:
            'M22_CREATOR_SESSION_CAPACITY_REACHED',
        },
      ],
    )
  }

  let booking =
    null

  try {
    let providerOrder =
      null

    if (
      session.accessType ===
      'paid'
    ) {
      providerOrder =
        await createRazorpayOrder({
          amountMinor:
            session.priceMinor,

          currency:
            session.currency,

          receipt:
            `creator-${crypto.randomUUID()
              .replaceAll(
                '-',
                '',
              )
              .slice(
                0,
                24,
              )}`,

          notes: {
            domain:
              'creator_session_booking',

            sessionId:
              id(
                session._id,
              ),

            customerUserId:
              id(
                userId,
              ),
          },
        })
    }

    booking =
      await CreatorSessionBooking.create({
        sessionId:
          session._id,

        courseId:
          session.courseId,

        customerUserId:
          userId,

        status:
          session.accessType ===
          'paid'
            ? 'payment_required'
            : 'confirmed',

        accessTypeSnapshot:
          session.accessType,

        amountMinor:
          session.accessType ===
          'paid'
            ? session.priceMinor
            : 0,

        currency:
          session.currency,

        idempotencyKey,

        provider:
          session.accessType ===
          'paid'
            ? 'razorpay'
            : 'none',

        providerOrderId:
          providerOrder?.providerOrderId ||
          '',

        entitlementId:
          entitlement?._id ||
          null,

        confirmedAt:
          session.accessType ===
          'paid'
            ? null
            : new Date(),
      })

    await appendSessionEvent({
      session,

      booking,

      actorType:
        'customer',

      actorUser,

      eventType:
        'seat_reserved',

      reason:
        'Customer reserved one bounded Creator session seat.',

      metadata: {
        accessType:
          session.accessType,
      },
    })

    let checkout =
      null

    if (providerOrder) {
      await appendSessionEvent({
        session,

        booking,

        actorType:
          'system',

        eventType:
          'payment_order_created',

        reason:
          'Backend created hosted payment-provider order from server-owned Creator session economics.',

        metadata: {
          provider:
            'razorpay',

          amountMinor:
            booking.amountMinor,

          currency:
            booking.currency,
        },
      })

      const publicConfig =
        getRazorpayPublicConfig()

      checkout = {
        provider:
          'razorpay',

        keyId:
          publicConfig.keyId,

        providerOrderId:
          booking.providerOrderId,

        amountMinor:
          booking.amountMinor,

        currency:
          booking.currency,
      }
    }

    return {
      booking:
        serializeBooking(
          booking,
        ),

      checkout,

      deduplicated:
        false,

      policy: {
        clientAmountTrusted:
          false,

        rawCardDataHandledByEpantry:
          false,

        automaticCreatorPayout:
          false,

        settlementClaimed:
          false,
      },
    }
  } catch (error) {
    await CreatorSession.updateOne(
      {
        _id:
          session._id,

        reservedSeats: {
          $gt:
            0,
        },
      },
      {
        $inc: {
          reservedSeats:
            -1,
        },
      },
    )

    throw error
  }
}

export async function verifyCreatorBookingPayment({
  bookingId,
  input,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const userId =
    actorId(
      actorUser,
    )

  const booking =
    await CreatorSessionBooking.findOne({
      _id:
        bookingId,

      customerUserId:
        userId,
    })

  if (!booking) {
    throw new ApiError(
      404,
      'Creator session booking was not found.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_NOT_FOUND',
        },
      ],
    )
  }

  if (
    booking.status ===
    'confirmed'
  ) {
    return {
      booking:
        serializeBooking(
          booking,
        ),

      deduplicated:
        true,
    }
  }

  if (
    booking.status !==
      'payment_required' ||
    booking.provider !==
      'razorpay'
  ) {
    throw new ApiError(
      409,
      'Booking does not have a payable hosted-checkout state.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_PAYMENT_STATE_INVALID',
        },
      ],
    )
  }

  if (
    input.providerOrderId !==
    booking.providerOrderId
  ) {
    throw new ApiError(
      409,
      'Payment provider order does not match this booking.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_PROVIDER_ORDER_MISMATCH',
        },
      ],
    )
  }

  const valid =
    verifyRazorpayCheckoutSignature({
      providerOrderId:
        input.providerOrderId,

      providerPaymentId:
        input.providerPaymentId,

      signature:
        input.signature,
    })

  if (!valid) {
    throw new ApiError(
      409,
      'Hosted checkout signature verification failed.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_PAYMENT_SIGNATURE_INVALID',
        },
      ],
    )
  }

  const existingEvidence =
    await CreatorPaymentEvidence.findOne({
      bookingId:
        booking._id,
    }).lean()

  if (!existingEvidence) {
    await CreatorPaymentEvidence.create({
      bookingId:
        booking._id,

      customerUserId:
        userId,

      provider:
        'razorpay',

      providerOrderId:
        input.providerOrderId,

      providerPaymentId:
        input.providerPaymentId,

      amountMinor:
        booking.amountMinor,

      currency:
        booking.currency,

      checkoutSignatureVerified:
        true,

      settlementOrCreatorPayoutClaimed:
        false,
    })
  }

  const session =
    await CreatorSession.findById(
      booking.sessionId,
    )

  booking.status =
    'confirmed'

  booking.providerPaymentId =
    input.providerPaymentId

  booking.confirmedAt =
    new Date()

  await booking.save()

  if (session) {
    await appendSessionEvent({
      session,

      booking,

      actorType:
        'payment_provider',

      eventType:
        'payment_signature_verified',

      reason:
        'Existing payment-provider checkout signature helper verified the booking evidence.',

      metadata: {
        settlementOrCreatorPayoutClaimed:
          false,
      },
    })

    await appendSessionEvent({
      session,

      booking,

      actorType:
        'system',

      eventType:
        'booking_confirmed',

      reason:
        'Booking confirmed after hosted checkout evidence verification.',
    })
  }

  return {
    booking:
      serializeBooking(
        booking,
      ),

    deduplicated:
      false,

    policy: {
      settlementOrCreatorPayoutClaimed:
        false,

      rawCardDataHandledByEpantry:
        false,

      m16SettlementAuthorityPreserved:
        true,
    },
  }
}

export async function cancelCreatorBooking({
  bookingId,
  reason,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const userId =
    actorId(
      actorUser,
    )

  const booking =
    await CreatorSessionBooking.findOne({
      _id:
        bookingId,

      customerUserId:
        userId,
    })

  if (!booking) {
    throw new ApiError(
      404,
      'Creator session booking was not found.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_NOT_FOUND',
        },
      ],
    )
  }

  if (
    [
      'cancelled',
      'attended',
    ].includes(
      booking.status,
    )
  ) {
    throw new ApiError(
      409,
      'Creator booking cannot be cancelled from its current state.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_CANCEL_STATE_INVALID',
        },
      ],
    )
  }

  const session =
    await CreatorSession.findById(
      booking.sessionId,
    )

  if (!session) {
    throw new ApiError(
      404,
      'Creator session was not found.',
      [
        {
          code:
            'M22_CREATOR_SESSION_NOT_FOUND',
        },
      ],
    )
  }

  const cutoffAt =
    new Date(
      session.startsAt.getTime() -
        Number(
          session.cancellationCutoffMinutes ||
          0,
        ) *
          60 *
          1000,
    )

  if (
    new Date() >=
    cutoffAt
  ) {
    throw new ApiError(
      409,
      'Creator session cancellation cutoff has passed.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_CANCELLATION_CUTOFF_PASSED',
        },
      ],
    )
  }

  const paid =
    Boolean(
      booking.providerPaymentId,
    )

  booking.status =
    paid
      ? 'refund_review_required'
      : 'cancelled'

  booking.cancelledAt =
    new Date()

  if (paid) {
    booking.refundReviewRequiredAt =
      new Date()
  }

  await booking.save()

  await CreatorSession.updateOne(
    {
      _id:
        session._id,

      reservedSeats: {
        $gt:
          0,
      },
    },
    {
      $inc: {
        reservedSeats:
          -1,
      },
    },
  )

  await appendSessionEvent({
    session,

    booking,

    actorType:
      'customer',

    actorUser,

    eventType:
      paid
        ? 'refund_review_required'
        : 'booking_cancelled',

    reason,

    metadata: {
      providerRefundExecuted:
        false,

      requiresFinanceReview:
        paid,
    },
  })

  return {
    booking:
      serializeBooking(
        booking,
      ),

    policy: {
      automaticRefundExecuted:
        false,

      financeReviewRequired:
        paid,
    },
  }
}

export async function recordCreatorAttendance({
  bookingId,
  reason,
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const context =
    await ownedCreatorContext(
      actorUser,
    )

  if (!context.profile) {
    throw new ApiError(
      404,
      'Creator profile is required.',
      [
        {
          code:
            'M22_CREATOR_PROFILE_REQUIRED',
        },
      ],
    )
  }

  const booking =
    await CreatorSessionBooking.findById(
      bookingId,
    )

  if (!booking) {
    throw new ApiError(
      404,
      'Creator booking was not found.',
      [
        {
          code:
            'M22_CREATOR_BOOKING_NOT_FOUND',
        },
      ],
    )
  }

  const session =
    await CreatorSession.findOne({
      _id:
        booking.sessionId,

      ownerUserId:
        context.userId,

      creatorProfileId:
        context.profile._id,
    })

  if (!session) {
    throw new ApiError(
      404,
      'Owned Creator session was not found.',
      [
        {
          code:
            'M22_CREATOR_SESSION_NOT_OWNED',
        },
      ],
    )
  }

  if (
    booking.status !==
    'confirmed'
  ) {
    throw new ApiError(
      409,
      'Only a confirmed booking can record attendance.',
      [
        {
          code:
            'M22_CREATOR_ATTENDANCE_BOOKING_STATE_INVALID',
        },
      ],
    )
  }

  if (
    new Date() <
    session.startsAt
  ) {
    throw new ApiError(
      409,
      'Attendance cannot be recorded before the session starts.',
      [
        {
          code:
            'M22_CREATOR_ATTENDANCE_TOO_EARLY',
        },
      ],
    )
  }

  booking.status =
    'attended'

  booking.attendedAt =
    new Date()

  await booking.save()

  await appendSessionEvent({
    session,

    booking,

    actorType:
      'creator',

    actorUser,

    eventType:
      'attendance_recorded',

    reason,

    metadata: {
      attendanceIsPaymentOrFoodTruth:
        false,
    },
  })

  return {
    booking:
      serializeBooking(
        booking,
      ),
  }
}

export async function listMyCreatorBookings({
  actorUser,
}) {
  await requireM22SafeExpansionFeature()

  const userId =
    actorId(
      actorUser,
    )

  const bookings =
    await CreatorSessionBooking.find({
      customerUserId:
        userId,
    })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        100,
      )
      .lean()

  return {
    bookings:
      bookings.map(
        serializeBooking,
      ),
  }
}