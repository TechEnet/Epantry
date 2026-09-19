import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
  Pack,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  MarketplaceOrganization,
  ServiceArea,
} from '../marketplace/marketplace.models.js'

import {
  normalizePostalCode,
} from '../marketplace/marketplace.constants.js'

import {
  getSellableQuantity,
} from '../marketplace/marketplace.inventory.service.js'

import {
  listPublicEligibleOffers,
} from '../marketplace/marketplace.public.service.js'

import {
  resolveFulfillmentIntersection,
  resolveServiceAreaInventoryNodeIds,
} from '../marketplace/marketplace.serviceability.service.js'

import {
  getOutcomePlan,
} from '../outcomes/outcomePlan.service.js'

import {
  requireCurrentPantryHousehold,
} from '../pantry/pantry.service.js'

import {
  buildCommerceComparisonOptions,
  calculatePackPlan,
  COMMERCE_OBJECTIVES,
  sortCandidatesForObjective,
} from './commerce.engine.js'

import {
  BasketQuote,
  MarketplaceCart,
  ProductMatch,
} from './commerce.models.js'

const PRODUCT_MATCH_LIMIT_PER_REQUIREMENT =
  24

function stringifyId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(value)
}

function actorIdFromUser(actorUser) {
  const actorUserId =
    actorUser?._id ||
    actorUser?.id

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'COMMERCE_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return actorUserId
}

function escapeRegex(value) {
  return String(
    value || '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function buildCanonicalNameTokenRegex(
  canonicalName,
) {
  const escaped =
    escapeRegex(
      String(
        canonicalName || '',
      ).trim(),
    )

  if (
    !escaped
  ) {
    return null
  }

  return new RegExp(
    `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
    'i',
  )
}

function currentPublishedVersionFilter(
  now,
) {
  return {
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
              $lte: now,
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
              $gt: now,
            },
          },
        ],
      },
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Conservative Product Identity Matching
|--------------------------------------------------------------------------
|
| Launch-safe match:
|
| 1. canonical Ingredient name OR one governed alias occurs as an explicit token
|    in Product name
| OR
| 2. Product has one single canonical ingredient equal to requirement.
|
| A generic multi-ingredient containment relationship is NOT enough.
| No fuzzy/AI/embedding matching occurs here.
|
*/

function detectProductMatchMethod({
  version,
  canonicalIngredientId,
  nameRegexes,
}) {
  const displayName =
    String(
      version.displayName || '',
    )

  if (
    Array.isArray(
      nameRegexes,
    ) &&
    nameRegexes.some(
      (nameRegex) =>
        nameRegex.test(
          displayName,
        ),
    )
  ) {
    return 'canonical_name_token'
  }

  const ingredients =
    Array.isArray(
      version.ingredients,
    )
      ? version.ingredients
      : []

  if (
    ingredients.length === 1 &&
    stringifyId(
      ingredients[0]
        ?.ingredientId,
    ) ===
      stringifyId(
        canonicalIngredientId,
      )
  ) {
    return 'single_ingredient_identity'
  }

  return null
}

async function findConservativeProductVersions({
  canonicalIngredientId,
  now,
}) {
  const ingredient =
    await CanonicalIngredient
      .findOne({
        _id:
          canonicalIngredientId,

        status:
          'active',
      })
      .select({
        canonicalName: 1,
        aliases: 1,
      })
      .lean()

  if (
    !ingredient
  ) {
    return []
  }

  const governedIdentityNames =
    [
      ingredient.canonicalName,
      ...(Array.isArray(
        ingredient.aliases,
      )
        ? ingredient.aliases
        : []),
    ]
      .map(
        (value) =>
          String(
            value || '',
          ).trim(),
      )
      .filter(Boolean)

  const uniqueIdentityNames =
    [
      ...new Map(
        governedIdentityNames.map(
          (value) => [
            value.toLocaleLowerCase(),
            value,
          ],
        ),
      ).values(),
    ]

  const nameRegexes =
    uniqueIdentityNames
      .map(
        buildCanonicalNameTokenRegex,
      )
      .filter(Boolean)

  const identityFilter = {
    $or: [
      ...nameRegexes.map(
        (nameRegex) => ({
          displayName: {
            $regex:
              nameRegex,
          },
        }),
      ),

      {
        'ingredients.ingredientId':
          canonicalIngredientId,
      },
    ],
  }

  const versions =
    await ProductVersion
      .find({
        ...currentPublishedVersionFilter(
          now,
        ),

        ...identityFilter,
      })
      .sort({
        publishedAt: -1,
        version: -1,
        _id: 1,
      })
      .limit(60)
      .select({
        packId: 1,
        displayName: 1,
        netQuantity: 1,
        ingredients: 1,
        publishedAt: 1,
        version: 1,
      })
      .lean()

  const conservative =
    versions
      .map(
        (version) => ({
          version,

          matchMethod:
            detectProductMatchMethod({
              version,
              canonicalIngredientId,
              nameRegexes,
            }),
        }),
      )
      .filter(
        (item) =>
          Boolean(
            item.matchMethod,
          ),
      )

  if (
    conservative.length === 0
  ) {
    return []
  }

  const packIds = [
    ...new Set(
      conservative.map(
        (item) =>
          stringifyId(
            item.version
              .packId,
          ),
      ),
    ),
  ]

  const activePacks =
    await Pack
      .find({
        _id: {
          $in: packIds,
        },

        status:
          'active',
      })
      .select({
        _id: 1,
      })
      .lean()

  const activePackIds =
    new Set(
      activePacks.map(
        (pack) =>
          stringifyId(
            pack._id,
          ),
      ),
    )

  return conservative.filter(
    (item) =>
      activePackIds.has(
        stringifyId(
          item.version
            .packId,
        ),
      ),
  )
}

/*
|--------------------------------------------------------------------------
| Exact Serviceable Inventory Capacity
|--------------------------------------------------------------------------
|
| M05 public Offer projection intentionally hides exact inventory.
|
| M11 may use internal M05 inventory truth for deterministic cart feasibility
| while still never exposing warehouse stock quantity as public Product truth.
|
*/

async function resolveServiceableOfferCapacity({
  offerId,
  pincode,
  fulfillmentType,
}) {
  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  const offer =
    await HostOffer
      .findOne({
        _id:
          offerId,

        status:
          'active',
      })
      .select({
        _id: 1,
        organizationId: 1,
        fulfillmentTypes: 1,
      })
      .lean()

  if (
    !offer
  ) {
    return {
      sellableQuantity: 0,
      latestObservedAt: null,
      organizationId: null,
    }
  }

  const organization =
    await MarketplaceOrganization
      .findOne({
        _id:
          offer.organizationId,

        status:
          'active',
      })
      .select({
        _id: 1,
      })
      .lean()

  if (
    !organization
  ) {
    return {
      sellableQuantity: 0,
      latestObservedAt: null,
      organizationId: null,
    }
  }

  const [
    serviceAreas,
    activeNodes,
  ] =
    await Promise.all([
      ServiceArea
        .find({
          organizationId:
            organization._id,

          status:
            'active',

          postalCodes:
            normalizedPincode,
        })
        .select({
          inventoryNodeId: 1,
          fulfillmentTypes: 1,
        })
        .lean(),

      InventoryNode
        .find({
          organizationId:
            organization._id,

          status:
            'active',
        })
        .select({
          _id: 1,
        })
        .lean(),
    ])

  const activeNodeIds =
    activeNodes.map(
      (node) =>
        stringifyId(
          node._id,
        ),
    )

  const eligibleNodeIds =
    new Set()

  for (
    const serviceArea
    of serviceAreas
  ) {
    const supported =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes:
          offer.fulfillmentTypes,

        serviceAreaFulfillmentTypes:
          serviceArea.fulfillmentTypes,

        requestedFulfillmentType:
          fulfillmentType,
      })

    if (
      supported.length === 0
    ) {
      continue
    }

    const nodeIds =
      resolveServiceAreaInventoryNodeIds({
        serviceArea,

        activeInventoryNodeIds:
          activeNodeIds,
      })

    for (
      const nodeId
      of nodeIds
    ) {
      eligibleNodeIds.add(
        stringifyId(
          nodeId,
        ),
      )
    }
  }

  if (
    eligibleNodeIds.size === 0
  ) {
    return {
      sellableQuantity: 0,

      latestObservedAt:
        null,

      organizationId:
        stringifyId(
          organization._id,
        ),
    }
  }

  const snapshots =
    await InventorySnapshot
      .find({
        organizationId:
          organization._id,

        offerId:
          offer._id,

        inventoryNodeId: {
          $in: [
            ...eligibleNodeIds,
          ],
        },
      })
      .sort({
        observedAt: -1,
        _id: -1,
      })
      .lean()

  const latestByNode =
    new Map()

  for (
    const snapshot
    of snapshots
  ) {
    const nodeId =
      stringifyId(
        snapshot
          .inventoryNodeId,
      )

    if (
      !latestByNode.has(
        nodeId,
      )
    ) {
      latestByNode.set(
        nodeId,
        snapshot,
      )
    }
  }

  let sellableQuantity = 0

  let latestObservedAt = null

  for (
    const snapshot
    of latestByNode.values()
  ) {
    sellableQuantity +=
      getSellableQuantity(
        snapshot,
      )

    if (
      !latestObservedAt ||
      new Date(
        snapshot.observedAt,
      ) >
        new Date(
          latestObservedAt,
        )
    ) {
      latestObservedAt =
        snapshot.observedAt
    }
  }

  return {
    sellableQuantity,

    latestObservedAt,

    organizationId:
      stringifyId(
        organization._id,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Requirement -> Eligible Marketplace Candidates
|--------------------------------------------------------------------------
*/

async function matchRequirementToMarketplace({
  requirement,
  pincode,
  fulfillmentType,
  now,
}) {
  /*
  |--------------------------------------------------------------------------
  | Unknown Product Constraints Fail Closed
  |--------------------------------------------------------------------------
  |
  | Never silently ignore a governed dietary/safety/product constraint.
  |
  */

  if (
    Array.isArray(
      requirement
        .productConstraints,
    ) &&
    requirement
      .productConstraints
      .length > 0
  ) {
    return {
      candidates: [],

      unmatchedReason:
        'PRODUCT_CONSTRAINTS_REQUIRE_GOVERNED_MATCHING',
    }
  }

  const productVersions =
    await findConservativeProductVersions({
      canonicalIngredientId:
        requirement
          .canonicalIngredientId,

      now,
    })

  const candidates = []

  for (
    const item
    of productVersions
  ) {
    const version =
      item.version

    const netQuantity =
      version.netQuantity

    if (
      !netQuantity ||
      !Number.isFinite(
        Number(
          netQuantity.value,
        ),
      ) ||
      !netQuantity.unit
    ) {
      continue
    }

    /*
    |--------------------------------------------------------------------------
    | Reuse Frozen M05 Eligibility
    |--------------------------------------------------------------------------
    |
    | This checks:
    |
    | - active Organization
    | - active Offer
    | - current PriceRule
    | - explicit serviceability
    | - sellable inventory > 0
    |
    */

    const publicResult =
      await listPublicEligibleOffers({
        packId:
          version.packId,

        pincode,

        fulfillmentType,
      })

    for (
      const offer
      of publicResult.offers ||
      []
    ) {
      const capacity =
        await resolveServiceableOfferCapacity({
          offerId:
            offer.id,

          pincode,

          fulfillmentType,
        })

      const packPlan =
        calculatePackPlan({
          requirementQuantity:
            requirement.quantity,

          requirementUnit:
            requirement.unit,

          packQuantity:
            netQuantity.value,

          packUnit:
            netQuantity.unit,

          minimumOrderQuantity:
            offer.minimumOrderQuantity,

          maximumOrderQuantity:
            offer.maximumOrderQuantity,

          sellableQuantity:
            capacity.sellableQuantity,
        })

      if (
        !packPlan
      ) {
        continue
      }

      const hostOffer =
        await HostOffer
          .findById(
            offer.id,
          )
          .select({
            organizationId: 1,
          })
          .lean()

      if (
        !hostOffer
      ) {
        continue
      }

      const unitPriceMinor =
        Number(
          offer.price
            ?.effectiveAmountMinor,
        )

      if (
        !Number.isInteger(
          unitPriceMinor,
        ) ||
        unitPriceMinor < 0
      ) {
        continue
      }

      candidates.push({
        _id:
          new mongoose.Types.ObjectId(),

        requirementLineId:
          requirement
            .requirementLineId,

        canonicalIngredientId:
          requirement
            .canonicalIngredientId,

        requirementLabel:
          requirement.label ||
          '',

        requirementQuantity:
          requirement.quantity,

        requirementUnit:
          requirement.unit,

        productVersionId:
          version._id,

        packId:
          version.packId,

        offerId:
          offer.id,

        organizationId:
          hostOffer
            .organizationId,

        sellerName:
          offer.seller
            ?.name ||
          'Marketplace Host',

        matchMethod:
          item.matchMethod,

        packQuantity:
          netQuantity.value,

        packUnit:
          netQuantity.unit,

        packQuantityInRequirementUnit:
          packPlan
            .packQuantityInRequirementUnit,

        packCount:
          packPlan.packCount,

        suppliedQuantity:
          packPlan
            .suppliedQuantity,

        surplusQuantity:
          packPlan
            .surplusQuantity,

        unitPrice: {
          amountMinor:
            unitPriceMinor,

          currency:
            offer.price
              ?.currency ||
            'INR',
        },

        lineTotal: {
          amountMinor:
            unitPriceMinor *
            packPlan.packCount,

          currency:
            offer.price
              ?.currency ||
            'INR',
        },

        priceRecordedAt:
          offer.price
            ?.recordedAt ||
          null,

        inventoryObservedAt:
          capacity
            .latestObservedAt ||
          offer.inventoryObservedAt ||
          null,

        inventoryAgeSeconds:
          offer.inventoryAgeSeconds ??
          null,

        fulfillmentTypes:
          offer.fulfillmentTypes ||
          [],
      })
    }
  }

  const ranked =
    sortCandidatesForObjective(
      candidates,
      'best_value',
    )
      .slice(
        0,
        PRODUCT_MATCH_LIMIT_PER_REQUIREMENT,
      )
      .map(
        (
          candidate,
          index,
        ) => ({
          ...candidate,

          candidateRank:
            index + 1,
        }),
      )

  return {
    candidates:
      ranked,

    unmatchedReason:
      ranked.length === 0
        ? 'NO_TRUSTWORTHY_ELIGIBLE_PACK_MATCH'
        : null,
  }
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

function serializeProductMatch(raw) {
  const match =
    typeof raw?.toObject ===
      'function'
      ? raw.toObject()
      : raw

  return {
    id:
      stringifyId(
        match._id,
      ),

    requirementLineId:
      stringifyId(
        match.requirementLineId,
      ),

    canonicalIngredientId:
      stringifyId(
        match.canonicalIngredientId,
      ),

    requirementLabel:
      match.requirementLabel ||
      '',

    requirementQuantity:
      match.requirementQuantity,

    requirementUnit:
      match.requirementUnit,

    productVersionId:
      stringifyId(
        match.productVersionId,
      ),

    packId:
      stringifyId(
        match.packId,
      ),

    offerId:
      stringifyId(
        match.offerId,
      ),

    organizationId:
      stringifyId(
        match.organizationId,
      ),

    sellerName:
      match.sellerName,

    matchMethod:
      match.matchMethod,

    packQuantity:
      match.packQuantity,

    packUnit:
      match.packUnit,

    packQuantityInRequirementUnit:
      match
        .packQuantityInRequirementUnit,

    packCount:
      match.packCount,

    suppliedQuantity:
      match.suppliedQuantity,

    surplusQuantity:
      match.surplusQuantity,

    unitPrice:
      match.unitPrice,

    lineTotal:
      match.lineTotal,

    priceRecordedAt:
      match.priceRecordedAt ||
      null,

    inventoryObservedAt:
      match.inventoryObservedAt ||
      null,

    inventoryAgeSeconds:
      match.inventoryAgeSeconds ??
      null,

    fulfillmentTypes:
      match.fulfillmentTypes ||
      [],

    candidateRank:
      match.candidateRank,
  }
}

function serializeQuoteOption({
  option,
  matchesById,
}) {
  return {
    optionKey:
      option.optionKey,

    label:
      option.label,

    matchedRequirementCount:
      option
        .matchedRequirementCount,

    totalRequirementCount:
      option
        .totalRequirementCount,

    sellerCount:
      option.sellerCount,

    itemSubtotalMinor:
      option
        .itemSubtotalMinor,

    currency:
      option.currency,

    totalSurplusQuantityScore:
      option
        .totalSurplusQuantityScore,

    totalLandedCostMinor:
      option.totalLandedCostMinor ??
      null,

    landedCostCompleteness:
      option
        .landedCostCompleteness,

    objectiveSatisfied:
      option.objectiveSatisfied ===
      true,

    explanationCodes:
      option.explanationCodes ||
      [],

    selections:
      (
        option.productMatchIds ||
        []
      )
        .map(
          (matchId) =>
            matchesById.get(
              stringifyId(
                matchId,
              ),
            ),
        )
        .filter(Boolean)
        .map(
          serializeProductMatch,
        ),
  }
}

async function serializeBasketQuote(
  rawQuote,
) {
  const quote =
    typeof rawQuote?.toObject ===
      'function'
      ? rawQuote.toObject()
      : rawQuote

  const matches =
    await ProductMatch
      .find({
        basketQuoteId:
          quote._id,
      })
      .sort({
        requirementLineId: 1,
        candidateRank: 1,
      })
      .lean()

  const matchesById =
    new Map(
      matches.map(
        (match) => [
          stringifyId(
            match._id,
          ),

          match,
        ],
      ),
    )

  const candidatesByRequirement =
    new Map()

  for (
    const match
    of matches
  ) {
    const requirementLineId =
      stringifyId(
        match.requirementLineId,
      )

    if (
      !candidatesByRequirement.has(
        requirementLineId,
      )
    ) {
      candidatesByRequirement.set(
        requirementLineId,
        [],
      )
    }

    candidatesByRequirement
      .get(
        requirementLineId,
      )
      .push(
        serializeProductMatch(
          match,
        ),
      )
  }

  return {
    quote: {
      id:
        stringifyId(
          quote._id,
        ),

      outcomePlanId:
        stringifyId(
          quote.outcomePlanId,
        ),

      outcomePlanRevision:
        quote
          .outcomePlanRevision,

      pincode:
        quote.pincode,

      requestedObjective:
        quote.requestedObjective,

      requestedFulfillmentType:
        quote
          .requestedFulfillmentType ||
        null,

      status:
        quote.status,

      recommendedOptionKey:
        quote
          .recommendedOptionKey ||
        null,

      quotedAt:
        quote.quotedAt,

      createdAt:
        quote.createdAt,
    },

    options:
      (
        quote.options ||
        []
      ).map(
        (option) =>
          serializeQuoteOption({
            option,
            matchesById,
          }),
      ),

    unmatchedRequirementLineIds:
      (
        quote
          .unmatchedRequirementLineIds ||
        []
      ).map(
        stringifyId,
      ),

    candidatesByRequirement:
      Object.fromEntries(
        candidatesByRequirement,
      ),

    transparency: {
      landedCostCompleteness:
        'item_prices_only',

      totalLandedCostClaimed:
        false,

      reason:
        'M05 currently exposes item prices, stock freshness and serviceability but no governed delivery-fee quote. M11 therefore does not label an item subtotal as total landed cost.',

      organicRankingOnly:
        true,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Ownership
|--------------------------------------------------------------------------
*/

async function requireOwnedBasketQuote({
  quoteId,
  actorUser,
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const quote =
    await BasketQuote
      .findOne({
        _id:
          quoteId,

        ownerUserId,

        householdId,

        status:
          'active',
      })

  if (
    !quote
  ) {
    throw new ApiError(
      404,
      'Basket quote was not found.',
      [
        {
          code:
            'BASKET_QUOTE_NOT_FOUND',
        },
      ],
    )
  }

  return {
    quote,
    ownerUserId,
    householdId,
  }
}

/*
|--------------------------------------------------------------------------
| POST /basket-optimize
|--------------------------------------------------------------------------
*/

export async function optimizeOutcomeBasket({
  outcomePlanId,
  pincode,
  objective = 'best_value',
  fulfillmentType = null,
  idempotencyKey,
  actorUser,
  now = new Date(),
}) {
  if (
    !COMMERCE_OBJECTIVES.includes(
      objective,
    )
  ) {
    throw new ApiError(
      400,
      'Unsupported commerce objective.',
      [
        {
          code:
            'COMMERCE_OBJECTIVE_INVALID',
        },
      ],
    )
  }

  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const existing =
    await BasketQuote
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return serializeBasketQuote(
      existing,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Consume M10 Handoff
  |--------------------------------------------------------------------------
  |
  | M11 never recomputes Pantry shortage.
  |
  */

  const outcome =
    await getOutcomePlan({
      planId:
        outcomePlanId,

      actorUser,
    })

  const requirements =
    Array.isArray(
      outcome
        .productMatchingInput,
    )
      ? outcome.productMatchingInput
      : []

  const normalizedPincode =
    normalizePostalCode(
      pincode,
    )

  const quoteId =
    new mongoose.Types.ObjectId()

  const candidateGroups = []

  const unmatchedRequirementLineIds =
    []

  for (
    const requirement
    of requirements
  ) {
    const result =
      await matchRequirementToMarketplace({
        requirement,

        pincode:
          normalizedPincode,

        fulfillmentType,

        now,
      })

    if (
      result.candidates.length === 0
    ) {
      unmatchedRequirementLineIds.push(
        requirement
          .requirementLineId,
      )

      continue
    }

    const candidates =
      result.candidates.map(
        (candidate) => ({
          ...candidate,

          ownerUserId,

          householdId,

          outcomePlanId,

          outcomePlanRevision:
            outcome.plan.revision,

          basketQuoteId:
            quoteId,

          quotedAt:
            now,
        }),
      )

    candidateGroups.push({
      requirementLineId:
        requirement
          .requirementLineId,

      candidates,
    })
  }

  const comparisonOptions =
    buildCommerceComparisonOptions({
      candidateGroups,

      totalRequirementCount:
        requirements.length,
    })

  const quoteDocument = {
    _id:
      quoteId,

    ownerUserId,

    householdId,

    outcomePlanId,

    outcomePlanRevision:
      outcome.plan.revision,

    pincode:
      normalizedPincode,

    requestedObjective:
      objective,

    requestedFulfillmentType:
      fulfillmentType ||
      null,

    status:
      'active',

    options:
      comparisonOptions.map(
        (option) => ({
          optionKey:
            option.optionKey,

          label:
            option.label,

          productMatchIds:
            option
              .selectedCandidates
              .map(
                (candidate) =>
                  candidate._id,
              ),

          matchedRequirementCount:
            option
              .matchedRequirementCount,

          totalRequirementCount:
            option
              .totalRequirementCount,

          sellerCount:
            option.sellerCount,

          itemSubtotalMinor:
            option
              .itemSubtotalMinor,

          currency:
            option.currency,

          totalSurplusQuantityScore:
            option
              .totalSurplusQuantityScore,

          totalLandedCostMinor:
            option
              .totalLandedCostMinor,

          landedCostCompleteness:
            option
              .landedCostCompleteness,

          objectiveSatisfied:
            option
              .objectiveSatisfied,

          explanationCodes:
            option
              .explanationCodes,
        }),
      ),

    recommendedOptionKey:
      objective,

    unmatchedRequirementLineIds,

    createIdempotencyKey:
      idempotencyKey,

    quotedAt:
      now,
  }

  const allMatches =
    candidateGroups.flatMap(
      (group) =>
        group.candidates,
    )

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        if (
          allMatches.length > 0
        ) {
          await ProductMatch
            .insertMany(
              allMatches,
              {
                session,
              },
            )
        }

        await BasketQuote.create(
          [
            quoteDocument,
          ],
          {
            session,
          },
        )
      },
    )
  } catch (error) {
    if (
      error?.code === 11000
    ) {
      const duplicate =
        await BasketQuote
          .findOne({
            ownerUserId,

            createIdempotencyKey:
              idempotencyKey,
          })
          .lean()

      if (
        duplicate
      ) {
        return serializeBasketQuote(
          duplicate,
        )
      }
    }

    throw error
  } finally {
    await session.endSession()
  }

  return serializeBasketQuote(
    quoteDocument,
  )
}

/*
|--------------------------------------------------------------------------
| GET /basket-quotes/:id
|--------------------------------------------------------------------------
*/

export async function getBasketQuote({
  quoteId,
  actorUser,
}) {
  const {
    quote,
  } =
    await requireOwnedBasketQuote({
      quoteId,
      actorUser,
    })

  return serializeBasketQuote(
    quote,
  )
}

/*
|--------------------------------------------------------------------------
| Cart Staleness Revalidation
|--------------------------------------------------------------------------
*/

async function revalidateProductMatchForCart({
  match,
  quote,
}) {
  const publicResult =
    await listPublicEligibleOffers({
      packId:
        match.packId,

      pincode:
        quote.pincode,

      fulfillmentType:
        quote
          .requestedFulfillmentType ||
        undefined,
    })

  const currentOffer =
    (
      publicResult.offers ||
      []
    ).find(
      (offer) =>
        stringifyId(
          offer.id,
        ) ===
        stringifyId(
          match.offerId,
        ),
    )

  if (
    !currentOffer
  ) {
    throw new ApiError(
      409,
      'Basket quote is stale because a selected offer is no longer eligible.',
      [
        {
          code:
            'BASKET_QUOTE_OFFER_STALE',

          offerId:
            stringifyId(
              match.offerId,
            ),
        },
      ],
    )
  }

  const currentPriceMinor =
    Number(
      currentOffer.price
        ?.effectiveAmountMinor,
    )

  if (
    currentPriceMinor !==
    Number(
      match.unitPrice
        ?.amountMinor,
    )
  ) {
    throw new ApiError(
      409,
      'Basket quote is stale because a selected price changed.',
      [
        {
          code:
            'BASKET_QUOTE_PRICE_CHANGED',

          offerId:
            stringifyId(
              match.offerId,
            ),
        },
      ],
    )
  }

  const capacity =
    await resolveServiceableOfferCapacity({
      offerId:
        match.offerId,

      pincode:
        quote.pincode,

      fulfillmentType:
        quote
          .requestedFulfillmentType ||
        undefined,
    })

  if (
    Number(
      capacity.sellableQuantity,
    ) <
    Number(
      match.packCount,
    )
  ) {
    throw new ApiError(
      409,
      'Basket quote is stale because selected inventory is no longer sufficient.',
      [
        {
          code:
            'BASKET_QUOTE_INVENTORY_CHANGED',

          offerId:
            stringifyId(
              match.offerId,
            ),
        },
      ],
    )
  }

  return {
    currentOffer,
    capacity,
  }
}

function serializeCart(rawCart) {
  const cart =
    typeof rawCart?.toObject ===
      'function'
      ? rawCart.toObject()
      : rawCart

  return {
    cart: {
      id:
        stringifyId(
          cart._id,
        ),

      sourceType:
        cart.sourceType ||
        'basket_quote',

      outcomePlanId:
        stringifyId(
          cart.outcomePlanId,
        ),

      outcomePlanRevision:
        cart
          .outcomePlanRevision,

      basketQuoteId:
        stringifyId(
          cart.basketQuoteId,
        ),

      optionKey:
        cart.optionKey,

      pincode:
        cart.pincode,

      fulfillmentType:
        cart.fulfillmentType ||
        null,

      itemSubtotalMinor:
        cart.itemSubtotalMinor,

      knownFeesMinor:
        cart.knownFeesMinor ??
        null,

      totalLandedCostMinor:
        cart.totalLandedCostMinor ??
        null,

      landedCostCompleteness:
        cart
          .landedCostCompleteness,

      currency:
        cart.currency,

      sellerCount:
        cart.sellerCount,

      status:
        cart.status,

      createdAt:
        cart.createdAt,

      updatedAt:
        cart.updatedAt,
    },

    items:
      (
        cart.items ||
        []
      ).map(
        (item) => ({
          id:
            stringifyId(
              item._id,
            ),

          requirementLineId:
            stringifyId(
              item
                .requirementLineId,
            ),

          productMatchId:
            stringifyId(
              item.productMatchId,
            ),

          canonicalIngredientId:
            stringifyId(
              item
                .canonicalIngredientId,
            ),

          displayName:
            item.displayName ||
            '',

          productVersionId:
            stringifyId(
              item.productVersionId,
            ),

          packId:
            stringifyId(
              item.packId,
            ),

          offerId:
            stringifyId(
              item.offerId,
            ),

          organizationId:
            stringifyId(
              item.organizationId,
            ),

          sellerName:
            item.sellerName,

          packCount:
            item.packCount,

          packQuantity:
            item.packQuantity,

          packUnit:
            item.packUnit,

          requiredQuantity:
            item.requiredQuantity,

          requiredUnit:
            item.requiredUnit,

          suppliedQuantity:
            item.suppliedQuantity,

          surplusQuantity:
            item.surplusQuantity,

          unitPrice:
            item.unitPrice,

          lineTotal:
            item.lineTotal,

          priceRecordedAt:
            item.priceRecordedAt ||
            null,

          inventoryObservedAt:
            item.inventoryObservedAt ||
            null,
        }),
      ),

    transparency: {
      totalLandedCostClaimed:
        cart
          .landedCostCompleteness ===
        'complete',

      leavingEpantry:
        false,

      checkoutCreated:
        false,
    },
  }
}

/*
|--------------------------------------------------------------------------
| POST /cart
|--------------------------------------------------------------------------
|
| Quote price, serviceability and inventory are revalidated.
|
| Cart does not reserve stock yet. Reservation belongs to Part 3 checkout.
|
*/

export async function createMarketplaceCart({
  basketQuoteId,
  optionKey,
  idempotencyKey,
  actorUser,
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const existing =
    await MarketplaceCart
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return serializeCart(
      existing,
    )
  }

  const {
    quote,
    householdId,
  } =
    await requireOwnedBasketQuote({
      quoteId:
        basketQuoteId,

      actorUser,
    })

  /*
  |--------------------------------------------------------------------------
  | M10 Revision Staleness
  |--------------------------------------------------------------------------
  */

  const outcome =
    await getOutcomePlan({
      planId:
        quote.outcomePlanId,

      actorUser,
    })

  if (
    Number(
      outcome.plan.revision,
    ) !==
    Number(
      quote
        .outcomePlanRevision,
    )
  ) {
    throw new ApiError(
      409,
      'Basket quote is stale because the Outcome Plan changed.',
      [
        {
          code:
            'BASKET_QUOTE_OUTCOME_PLAN_CHANGED',
        },
      ],
    )
  }

  const option =
    (
      quote.options ||
      []
    ).find(
      (item) =>
        item.optionKey ===
        optionKey,
    )

  if (
    !option
  ) {
    throw new ApiError(
      400,
      'Selected basket quote option does not exist.',
      [
        {
          code:
            'BASKET_QUOTE_OPTION_INVALID',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | EPANTRY Cart Requires Full Marketplace Coverage
  |--------------------------------------------------------------------------
  |
  | Partial/unmatched requirements must remain transparent and may later use
  | external handoff. They must not silently disappear from Cart.
  |
  */

  if (
    option
      .matchedRequirementCount !==
    option
      .totalRequirementCount
  ) {
    throw new ApiError(
      409,
      'Selected option cannot become an EPANTRY cart because some purchase requirements are unmatched.',
      [
        {
          code:
            'CART_REQUIREMENTS_UNMATCHED',
        },
      ],
    )
  }

  const selectedMatches =
    await ProductMatch
      .find({
        basketQuoteId:
          quote._id,

        _id: {
          $in:
            option.productMatchIds ||
            [],
        },
      })
      .lean()

  if (
    selectedMatches.length !==
    (
      option.productMatchIds ||
      []
    ).length
  ) {
    throw new ApiError(
      409,
      'Basket quote selection is incomplete.',
      [
        {
          code:
            'BASKET_QUOTE_SELECTION_INCOMPLETE',
        },
      ],
    )
  }

  const cartItems = []

  for (
    const match
    of selectedMatches
  ) {
    const {
      currentOffer,
      capacity,
    } =
      await revalidateProductMatchForCart({
        match,
        quote,
      })

    cartItems.push({
      requirementLineId:
        match.requirementLineId,

      productMatchId:
        match._id,

      canonicalIngredientId:
        match
          .canonicalIngredientId,

      productVersionId:
        match.productVersionId,

      packId:
        match.packId,

      offerId:
        match.offerId,

      organizationId:
        match.organizationId,

      sellerName:
        match.sellerName,

      packCount:
        match.packCount,

      packQuantity:
        match.packQuantity,

      packUnit:
        match.packUnit,

      requiredQuantity:
        match
          .requirementQuantity,

      requiredUnit:
        match
          .requirementUnit,

      suppliedQuantity:
        match
          .suppliedQuantity,

      surplusQuantity:
        match
          .surplusQuantity,

      unitPrice: {
        amountMinor:
          currentOffer
            .price
            .effectiveAmountMinor,

        currency:
          currentOffer
            .price
            .currency ||
          'INR',
      },

      lineTotal: {
        amountMinor:
          currentOffer
            .price
            .effectiveAmountMinor *
          match.packCount,

        currency:
          currentOffer
            .price
            .currency ||
          'INR',
      },

      priceRecordedAt:
        currentOffer
          .price
          .recordedAt ||
        null,

      inventoryObservedAt:
        capacity
          .latestObservedAt ||
        currentOffer
          .inventoryObservedAt ||
        null,
    })
  }

  const itemSubtotalMinor =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.lineTotal
          .amountMinor,
      0,
    )

  const sellerCount =
    new Set(
      cartItems.map(
        (item) =>
          stringifyId(
            item
              .organizationId,
          ),
      ),
    ).size

  try {
    const cart =
      await MarketplaceCart.create({
        ownerUserId,

        householdId,

        outcomePlanId:
          quote.outcomePlanId,

        outcomePlanRevision:
          quote
            .outcomePlanRevision,

        basketQuoteId:
          quote._id,

        optionKey,

        pincode:
          quote.pincode,

        fulfillmentType:
          quote
            .requestedFulfillmentType ||
          null,

        items:
          cartItems,

        itemSubtotalMinor,

        knownFeesMinor:
          null,

        totalLandedCostMinor:
          null,

        landedCostCompleteness:
          'item_prices_only',

        currency:
          option.currency ||
          'INR',

        sellerCount,

        status:
          'draft',

        createIdempotencyKey:
          idempotencyKey,
      })

    return serializeCart(
      cart,
    )
  } catch (error) {
    if (
      error?.code === 11000
    ) {
      const duplicate =
        await MarketplaceCart
          .findOne({
            ownerUserId,

            createIdempotencyKey:
              idempotencyKey,
          })
          .lean()

      if (
        duplicate
      ) {
        return serializeCart(
          duplicate,
        )
      }
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| GET /cart/:id
|--------------------------------------------------------------------------
*/

export async function getMarketplaceCart({
  cartId,
  actorUser,
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const cart =
    await MarketplaceCart
      .findOne({
        _id:
          cartId,

        ownerUserId,

        householdId,
      })
      .lean()

  if (
    !cart
  ) {
    throw new ApiError(
      404,
      'Marketplace Cart was not found.',
      [
        {
          code:
            'MARKETPLACE_CART_NOT_FOUND',
        },
      ],
    )
  }

  return serializeCart(
    cart,
  )
}