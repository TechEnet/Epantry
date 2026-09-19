import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

const PRECISION = 6

export const COMMERCE_OBJECTIVES =
  Object.freeze([
    'best_value',
    'minimum_waste',
    'one_retailer',
  ])

export function roundCommerceQuantity(value) {
  if (
    !Number.isFinite(
      Number(value),
    )
  ) {
    return null
  }

  return Number(
    Number(value).toFixed(
      PRECISION,
    ),
  )
}

function normalizeConvertedQuantity(result) {
  if (
    Number.isFinite(result)
  ) {
    return result
  }

  if (
    Number.isFinite(
      result?.quantity,
    )
  ) {
    return result.quantity
  }

  if (
    Number.isFinite(
      result?.convertedQuantity,
    )
  ) {
    return result.convertedQuantity
  }

  return null
}

/*
|--------------------------------------------------------------------------
| Pack -> Requirement Unit Conversion
|--------------------------------------------------------------------------
|
| Reuse M07 deterministic conversion.
|
| No retail Pack quantity is silently turned into Recipe quantity.
|
*/

export function convertPackQuantityToRequirementUnit({
  packQuantity,
  packUnit,
  requirementUnit,
}) {
  const numericQuantity =
    Number(packQuantity)

  if (
    !Number.isFinite(
      numericQuantity,
    ) ||
    numericQuantity <= 0 ||
    !packUnit ||
    !requirementUnit
  ) {
    return null
  }

  if (
    packUnit ===
    requirementUnit
  ) {
    return roundCommerceQuantity(
      numericQuantity,
    )
  }

  try {
    const converted =
      normalizeConvertedQuantity(
        convertRecipeQuantity({
          quantity:
            numericQuantity,

          fromUnit:
            packUnit,

          toUnit:
            requirementUnit,
        }),
      )

    return Number.isFinite(
      converted,
    )
      ? roundCommerceQuantity(
          converted,
        )
      : null
  } catch {
    return null
  }
}

/*
|--------------------------------------------------------------------------
| Pack Optimization
|--------------------------------------------------------------------------
|
| Example:
|
| genuine requirement = 300 g
| retail Pack = 200 g
|
| selected pack count = 2
| supplied = 400 g
| surplus = 100 g
|
*/

export function calculatePackPlan({
  requirementQuantity,
  requirementUnit,
  packQuantity,
  packUnit,
  minimumOrderQuantity = 1,
  maximumOrderQuantity = null,
  sellableQuantity = null,
}) {
  const required =
    Number(
      requirementQuantity,
    )

  const convertedPackQuantity =
    convertPackQuantityToRequirementUnit({
      packQuantity,
      packUnit,
      requirementUnit,
    })

  if (
    !Number.isFinite(
      required,
    ) ||
    required <= 0 ||
    !Number.isFinite(
      convertedPackQuantity,
    ) ||
    convertedPackQuantity <= 0
  ) {
    return null
  }

  const minimum =
    Math.max(
      1,

      Number.isInteger(
        Number(
          minimumOrderQuantity,
        ),
      )
        ? Number(
            minimumOrderQuantity,
          )
        : 1,
    )

  const rawPackCount =
    Math.ceil(
      required /
        convertedPackQuantity,
    )

  const packCount =
    Math.max(
      minimum,
      rawPackCount,
    )

  if (
    maximumOrderQuantity !== null &&
    maximumOrderQuantity !== undefined &&
    Number.isFinite(
      Number(
        maximumOrderQuantity,
      ),
    ) &&
    packCount >
      Number(
        maximumOrderQuantity,
      )
  ) {
    return null
  }

  if (
    sellableQuantity !== null &&
    sellableQuantity !== undefined &&
    Number.isFinite(
      Number(
        sellableQuantity,
      ),
    ) &&
    packCount >
      Number(
        sellableQuantity,
      )
  ) {
    return null
  }

  const suppliedQuantity =
    roundCommerceQuantity(
      packCount *
        convertedPackQuantity,
    )

  const surplusQuantity =
    roundCommerceQuantity(
      Math.max(
        0,

        suppliedQuantity -
          required,
      ),
    )

  return {
    packQuantityInRequirementUnit:
      convertedPackQuantity,

    packCount,

    suppliedQuantity,

    surplusQuantity,

    surplusRatio:
      required > 0
        ? roundCommerceQuantity(
            surplusQuantity /
              required,
          )
        : null,
  }
}

function compareText(
  left,
  right,
) {
  return String(
    left || '',
  ).localeCompare(
    String(
      right || '',
    ),
  )
}

function candidateCost(candidate) {
  return Number(
    candidate?.lineTotal
      ?.amountMinor ??
      candidate?.lineTotalMinor ??
      0,
  )
}

function candidateSurplusRatio(candidate) {
  const required =
    Number(
      candidate
        ?.requirementQuantity ||
        0,
    )

  const surplus =
    Number(
      candidate
        ?.surplusQuantity ||
        0,
    )

  return required > 0
    ? surplus / required
    : Number.POSITIVE_INFINITY
}

/*
|--------------------------------------------------------------------------
| Candidate Ranking
|--------------------------------------------------------------------------
|
| best_value:
|   known item total first, then surplus.
|
| minimum_waste:
|   surplus first, then known item total.
|
| This intentionally does NOT call either option "cheapest delivered" because
| governed delivery fees are not available yet.
|
*/

export function sortCandidatesForObjective(
  candidates,
  objective,
) {
  const copy = [
    ...(candidates || []),
  ]

  copy.sort(
    (
      left,
      right,
    ) => {
      if (
        objective ===
        'minimum_waste'
      ) {
        const surplusDifference =
          candidateSurplusRatio(
            left,
          ) -
          candidateSurplusRatio(
            right,
          )

        if (
          surplusDifference !== 0
        ) {
          return surplusDifference
        }

        const costDifference =
          candidateCost(left) -
          candidateCost(right)

        if (
          costDifference !== 0
        ) {
          return costDifference
        }
      } else {
        const costDifference =
          candidateCost(left) -
          candidateCost(right)

        if (
          costDifference !== 0
        ) {
          return costDifference
        }

        const surplusDifference =
          candidateSurplusRatio(
            left,
          ) -
          candidateSurplusRatio(
            right,
          )

        if (
          surplusDifference !== 0
        ) {
          return surplusDifference
        }
      }

      const sellerDifference =
        compareText(
          left.sellerName,
          right.sellerName,
        )

      if (
        sellerDifference !== 0
      ) {
        return sellerDifference
      }

      return compareText(
        left.offerId,
        right.offerId,
      )
    },
  )

  return copy
}

function buildSelectionSummary({
  optionKey,
  label,
  selectedCandidates,
  totalRequirementCount,
  objectiveSatisfied = true,
  explanationCodes = [],
}) {
  const sellerIds =
    new Set(
      selectedCandidates.map(
        (candidate) =>
          String(
            candidate
              .organizationId,
          ),
      ),
    )

  const itemSubtotalMinor =
    selectedCandidates.reduce(
      (
        total,
        candidate,
      ) =>
        total +
        candidateCost(
          candidate,
        ),
      0,
    )

  const totalSurplusQuantityScore =
    roundCommerceQuantity(
      selectedCandidates.reduce(
        (
          total,
          candidate,
        ) =>
          total +
          candidateSurplusRatio(
            candidate,
          ),
        0,
      ),
    )

  return {
    optionKey,
    label,

    selectedCandidates,

    matchedRequirementCount:
      selectedCandidates.length,

    totalRequirementCount,

    sellerCount:
      sellerIds.size,

    itemSubtotalMinor,

    currency:
      selectedCandidates[0]
        ?.lineTotal
        ?.currency ||
      'INR',

    totalSurplusQuantityScore,

    /*
    |--------------------------------------------------------------------------
    | No Fake Landed Cost
    |--------------------------------------------------------------------------
    */

    totalLandedCostMinor:
      null,

    landedCostCompleteness:
      'item_prices_only',

    objectiveSatisfied,

    explanationCodes: [
      ...explanationCodes,

      'DELIVERY_FEES_NOT_AVAILABLE',

      'TOTAL_LANDED_COST_NOT_CLAIMED',
    ],
  }
}

function selectPerRequirement(
  candidateGroups,
  objective,
) {
  const selected = []

  for (
    const group
    of candidateGroups
  ) {
    const ranked =
      sortCandidatesForObjective(
        group.candidates,
        objective,
      )

    if (
      ranked[0]
    ) {
      selected.push(
        ranked[0],
      )
    }
  }

  return selected
}

/*
|--------------------------------------------------------------------------
| One Retailer
|--------------------------------------------------------------------------
|
| One-retailer label is used only if one Organization can cover every
| requirement.
|
| If not possible, fallback selection stays transparent and
| objectiveSatisfied=false.
|
*/

function selectOneRetailer(
  candidateGroups,
) {
  if (
    candidateGroups.length === 0
  ) {
    return {
      selectedCandidates: [],

      objectiveSatisfied:
        true,

      explanationCodes: [
        'NO_PURCHASE_REQUIREMENTS',
      ],
    }
  }

  const organizationIds =
    new Set()

  for (
    const group
    of candidateGroups
  ) {
    for (
      const candidate
      of group.candidates
    ) {
      organizationIds.add(
        String(
          candidate
            .organizationId,
        ),
      )
    }
  }

  const completeOptions = []

  for (
    const organizationId
    of organizationIds
  ) {
    const selected = []

    let complete = true

    for (
      const group
      of candidateGroups
    ) {
      const organizationCandidates =
        group.candidates.filter(
          (candidate) =>
            String(
              candidate
                .organizationId,
            ) ===
            organizationId,
        )

      const ranked =
        sortCandidatesForObjective(
          organizationCandidates,
          'best_value',
        )

      if (
        !ranked[0]
      ) {
        complete = false
        break
      }

      selected.push(
        ranked[0],
      )
    }

    if (
      complete
    ) {
      completeOptions.push(
        selected,
      )
    }
  }

  if (
    completeOptions.length === 0
  ) {
    return {
      selectedCandidates:
        selectPerRequirement(
          candidateGroups,
          'best_value',
        ),

      objectiveSatisfied:
        false,

      explanationCodes: [
        'ONE_RETAILER_NOT_AVAILABLE',

        'FALLBACK_TO_BEST_KNOWN_ITEM_VALUE',
      ],
    }
  }

  completeOptions.sort(
    (
      left,
      right,
    ) => {
      const leftCost =
        left.reduce(
          (
            total,
            candidate,
          ) =>
            total +
            candidateCost(
              candidate,
            ),
          0,
        )

      const rightCost =
        right.reduce(
          (
            total,
            candidate,
          ) =>
            total +
            candidateCost(
              candidate,
            ),
          0,
        )

      if (
        leftCost !==
        rightCost
      ) {
        return (
          leftCost -
          rightCost
        )
      }

      return compareText(
        left[0]?.sellerName,
        right[0]?.sellerName,
      )
    },
  )

  return {
    selectedCandidates:
      completeOptions[0],

    objectiveSatisfied:
      true,

    explanationCodes: [
      'ONE_RETAILER_FULL_COVERAGE',
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Comparison Options
|--------------------------------------------------------------------------
*/

export function buildCommerceComparisonOptions({
  candidateGroups = [],
  totalRequirementCount =
    candidateGroups.length,
}) {
  const bestValue =
    buildSelectionSummary({
      optionKey:
        'best_value',

      label:
        'Best Value',

      selectedCandidates:
        selectPerRequirement(
          candidateGroups,
          'best_value',
        ),

      totalRequirementCount,

      explanationCodes: [
        'LOWEST_KNOWN_ITEM_TOTAL_PER_REQUIREMENT',

        'PACK_SURPLUS_USED_AS_TIE_BREAKER',
      ],
    })

  const minimumWaste =
    buildSelectionSummary({
      optionKey:
        'minimum_waste',

      label:
        'Minimum Waste',

      selectedCandidates:
        selectPerRequirement(
          candidateGroups,
          'minimum_waste',
        ),

      totalRequirementCount,

      explanationCodes: [
        'LOWEST_PACK_SURPLUS_RATIO_PER_REQUIREMENT',

        'KNOWN_ITEM_TOTAL_USED_AS_TIE_BREAKER',
      ],
    })

  const oneRetailerSelection =
    selectOneRetailer(
      candidateGroups,
    )

  const oneRetailer =
    buildSelectionSummary({
      optionKey:
        'one_retailer',

      label:
        'One Retailer',

      selectedCandidates:
        oneRetailerSelection
          .selectedCandidates,

      totalRequirementCount,

      objectiveSatisfied:
        oneRetailerSelection
          .objectiveSatisfied,

      explanationCodes:
        oneRetailerSelection
          .explanationCodes,
    })

  return [
    bestValue,
    minimumWaste,
    oneRetailer,
  ]
}