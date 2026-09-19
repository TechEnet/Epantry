import {
  createHash,
} from 'node:crypto'

import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

const CONFIRMED_PANTRY_STATES =
  new Set([
    'confirmed_available',
    'replenished_elsewhere',
  ])

const UNCERTAIN_PANTRY_STATES =
  new Set([
    'inferred_available',
    'uncertain',
    'running_low',
  ])

const READINESS_PRIORITY =
  Object.freeze({
    enough:
      0,

    likely_enough:
      1,

    needs_confirmation:
      2,

    running_low_before_meal:
      3,

    expected_depleted:
      4,

    missing:
      5,
  })

function stringifyId(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value,
  )
}

function roundQuantity(
  value,
) {
  if (
    !Number.isFinite(
      Number(
        value,
      ),
    )
  ) {
    return null
  }

  return Number(
    Number(
      value,
    ).toFixed(
      6,
    ),
  )
}

function normalizeConvertedQuantity(
  result,
) {
  if (
    Number.isFinite(
      result,
    )
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

export function safePlanningUnitConversion({
  quantity,
  fromUnit,
  toUnit,
}) {
  const numericQuantity =
    Number(
      quantity,
    )

  if (
    !Number.isFinite(
      numericQuantity,
    ) ||
    numericQuantity <
      0 ||
    !fromUnit ||
    !toUnit
  ) {
    return null
  }

  if (
    fromUnit ===
    toUnit
  ) {
    return numericQuantity
  }

  try {
    return normalizeConvertedQuantity(
      convertRecipeQuantity({
        quantity:
          numericQuantity,

        fromUnit,

        toUnit,
      }),
    )
  } catch {
    return null
  }
}

function normalizeRequirement(
  requirement,
) {
  const quantity =
    Number(
      requirement?.quantity ??
      requirement?.scaledQuantity ??
      requirement?.requirementQuantity,
    )

  return {
    canonicalIngredientId:
      stringifyId(
        requirement?.canonicalIngredientId ||
        requirement?.ingredientId,
      ),

    label:
      requirement?.label ||
      requirement?.ingredientName ||
      requirement?.name ||
      null,

    quantity:
      Number.isFinite(
        quantity,
      ) &&
      quantity >=
        0
        ? quantity
        : null,

    unit:
      requirement?.unit ||
      requirement?.scaledUnit ||
      requirement?.requirementUnit ||
      null,

    optional:
      requirement?.optional ===
        true ||
      requirement?.isOptional ===
        true,
  }
}

function normalizePantryBalance(
  pantryItem,
) {
  const quantity =
    pantryItem?.quantity ||
    pantryItem?.quantityEstimate ||
    null

  const state =
    pantryItem?.state ||
    'uncertain'

  const base = {
    pantryItemId:
      stringifyId(
        pantryItem?.id ||
        pantryItem?._id,
      ),

    canonicalIngredientId:
      stringifyId(
        pantryItem?.canonicalIngredientId,
      ),

    state,

    quantityMode:
      quantity?.mode ||
      'unknown',

    unit:
      quantity?.unit ||
      null,

    initialQuantity:
      null,

    remainingQuantity:
      null,

    reservationBasis:
      null,

    uncertain:
      false,

    untracked:
      false,

    hardOut:
      false,
  }

  if (
    state ===
    'do_not_track'
  ) {
    return {
      ...base,

      untracked:
        true,
    }
  }

  if (
    state ===
    'out'
  ) {
    return {
      ...base,

      hardOut:
        true,

      initialQuantity:
        0,

      remainingQuantity:
        0,
    }
  }

  if (
    UNCERTAIN_PANTRY_STATES.has(
      state,
    )
  ) {
    return {
      ...base,

      uncertain:
        true,
    }
  }

  if (
    !CONFIRMED_PANTRY_STATES.has(
      state,
    )
  ) {
    return {
      ...base,

      uncertain:
        true,
    }
  }

  if (
    quantity?.mode ===
      'exact' &&
    Number.isFinite(
      Number(
        quantity?.value ??
        quantity?.exact,
      ),
    ) &&
    quantity?.unit
  ) {
    const numeric =
      Math.max(
        0,
        Number(
          quantity?.value ??
          quantity?.exact,
        ),
      )

    return {
      ...base,

      initialQuantity:
        numeric,

      remainingQuantity:
        numeric,

      reservationBasis:
        'confirmed_exact',
    }
  }

  if (
    quantity?.mode ===
      'range' &&
    Number.isFinite(
      Number(
        quantity?.min,
      ),
    ) &&
    quantity?.unit
  ) {
    const numeric =
      Math.max(
        0,
        Number(
          quantity.min,
        ),
      )

    return {
      ...base,

      initialQuantity:
        numeric,

      remainingQuantity:
        numeric,

      reservationBasis:
        'confirmed_range_minimum',
    }
  }

  return {
    ...base,

    uncertain:
      true,
  }
}

function sortMeals(
  meals,
) {
  return [
    ...(meals || []),
  ].sort(
    (
      left,
      right,
    ) => {
      const leftAt =
        new Date(
          left.plannedAt,
        ).getTime()

      const rightAt =
        new Date(
          right.plannedAt,
        ).getTime()

      return (
        leftAt -
          rightAt ||
        Number(
          right.priority ||
          3,
        ) -
          Number(
            left.priority ||
            3,
          ) ||
        String(
          left.id ||
          left._id ||
          '',
        ).localeCompare(
          String(
            right.id ||
            right._id ||
            '',
          ),
        )
      )
    },
  )
}

function summarizeReadiness(
  lines,
) {
  const summary = {
    totalRequirements:
      0,

    enough:
      0,

    likelyEnough:
      0,

    runningLow:
      0,

    expectedDepleted:
      0,

    missing:
      0,

    needsConfirmation:
      0,
  }

  const keyByState = {
    enough:
      'enough',

    likely_enough:
      'likelyEnough',

    running_low_before_meal:
      'runningLow',

    expected_depleted:
      'expectedDepleted',

    missing:
      'missing',

    needs_confirmation:
      'needsConfirmation',
  }

  for (
    const line
    of lines ||
    []
  ) {
    if (
      line.optional
    ) {
      continue
    }

    summary.totalRequirements +=
      1

    const key =
      keyByState[
        line.readinessState
      ]

    if (
      key
    ) {
      summary[
        key
      ] +=
        1
    }
  }

  return summary
}

function aggregateMealReadiness(
  lines,
) {
  const mandatoryLines =
    (lines || []).filter(
      (
        line,
      ) =>
        !line.optional,
    )

  if (
    mandatoryLines.length ===
    0
  ) {
    return 'enough'
  }

  return mandatoryLines.reduce(
    (
      worst,
      line,
    ) =>
      READINESS_PRIORITY[
        line.readinessState
      ] >
      READINESS_PRIORITY[
        worst
      ]
        ? line.readinessState
        : worst,
    'enough',
  )
}

function allocateRequirement({
  requirement,
  meal,
  balancesByIngredient,
}) {
  const ingredientId =
    requirement.canonicalIngredientId

  const pantryBalances =
    ingredientId
      ? balancesByIngredient.get(
          ingredientId,
        ) ||
        []
      : []

  const base = {
    canonicalIngredientId:
      ingredientId,

    label:
      requirement.label,

    optional:
      requirement.optional,

    requiredQuantity:
      requirement.quantity,

    requiredUnit:
      requirement.unit,

    reservedQuantityInRequirementUnit:
      0,

    provenShortageQuantity:
      null,

    readinessState:
      'needs_confirmation',

    reasonCode:
      'PLANNING_REQUIREMENT_CANNOT_BE_VERIFIED',
  }

  if (
    !ingredientId ||
    !Number.isFinite(
      requirement.quantity,
    ) ||
    requirement.quantity <=
      0 ||
    !requirement.unit
  ) {
    return {
      line:
        base,

      reservations:
        [],
    }
  }

  const reservations = []

  let remainingRequirement =
    requirement.quantity

  let anyRangeMinimum =
    false

  let anyNumericInitially =
    false

  let anyNumericRemainingBefore =
    false

  let anyUncertain =
    false

  let anyUntracked =
    false

  let anyHardOut =
    false

  let anyRunningLow =
    false

  for (
    const balance
    of pantryBalances
  ) {
    if (
      balance.state ===
      'running_low'
    ) {
      anyRunningLow =
        true
    }

    if (
      balance.untracked
    ) {
      anyUntracked =
        true

      continue
    }

    if (
      balance.uncertain
    ) {
      anyUncertain =
        true

      continue
    }

    if (
      balance.hardOut
    ) {
      anyHardOut =
        true

      continue
    }

    if (
      !Number.isFinite(
        balance.initialQuantity,
      ) ||
      !Number.isFinite(
        balance.remainingQuantity,
      ) ||
      !balance.unit
    ) {
      anyUncertain =
        true

      continue
    }

    const initialInRequirementUnit =
      safePlanningUnitConversion({
        quantity:
          balance.initialQuantity,

        fromUnit:
          balance.unit,

        toUnit:
          requirement.unit,
      })

    const remainingBeforeInRequirementUnit =
      safePlanningUnitConversion({
        quantity:
          balance.remainingQuantity,

        fromUnit:
          balance.unit,

        toUnit:
          requirement.unit,
      })

    if (
      initialInRequirementUnit ===
        null ||
      remainingBeforeInRequirementUnit ===
        null
    ) {
      anyUncertain =
        true

      continue
    }

    if (
      initialInRequirementUnit >
      0
    ) {
      anyNumericInitially =
        true
    }

    if (
      remainingBeforeInRequirementUnit >
      0
    ) {
      anyNumericRemainingBefore =
        true
    }

    if (
      remainingRequirement <=
      0
    ) {
      continue
    }

    const requiredInPantryUnit =
      safePlanningUnitConversion({
        quantity:
          remainingRequirement,

        fromUnit:
          requirement.unit,

        toUnit:
          balance.unit,
      })

    if (
      requiredInPantryUnit ===
      null
    ) {
      anyUncertain =
        true

      continue
    }

    const reservedInPantryUnit =
      Math.min(
        balance.remainingQuantity,
        requiredInPantryUnit,
      )

    if (
      reservedInPantryUnit <=
      0
    ) {
      continue
    }

    const reservedInRequirementUnit =
      safePlanningUnitConversion({
        quantity:
          reservedInPantryUnit,

        fromUnit:
          balance.unit,

        toUnit:
          requirement.unit,
      })

    if (
      reservedInRequirementUnit ===
      null
    ) {
      anyUncertain =
        true

      continue
    }

    balance.remainingQuantity =
      roundQuantity(
        Math.max(
          0,
          balance.remainingQuantity -
            reservedInPantryUnit,
        ),
      )

    remainingRequirement =
      roundQuantity(
        Math.max(
          0,
          remainingRequirement -
            reservedInRequirementUnit,
        ),
      )

    if (
      balance.reservationBasis ===
      'confirmed_range_minimum'
    ) {
      anyRangeMinimum =
        true
    }

    reservations.push({
      pantryItemId:
        balance.pantryItemId,

      plannedMealId:
        stringifyId(
          meal.id ||
          meal._id,
        ),

      recipeVersionId:
        stringifyId(
          meal.recipeVersionId,
        ),

      canonicalIngredientId:
        ingredientId,

      reservedQuantity:
        roundQuantity(
          reservedInPantryUnit,
        ),

      unit:
        balance.unit,

      reservationBasis:
        balance.reservationBasis,

      reservedForDate:
        meal.plannedAt,
    })
  }

  const reservedQuantity =
    roundQuantity(
      Math.max(
        0,
        requirement.quantity -
          remainingRequirement,
      ),
    )

  if (
    remainingRequirement <=
    0
  ) {
    return {
      line: {
        ...base,

        reservedQuantityInRequirementUnit:
          reservedQuantity,

        provenShortageQuantity:
          0,

        readinessState:
          anyRangeMinimum
            ? 'likely_enough'
            : 'enough',

        reasonCode:
          anyRangeMinimum
            ? 'CONFIRMED_RANGE_MINIMUM_RESERVED'
            : 'CONFIRMED_PANTRY_RESERVED',
      },

      reservations,
    }
  }

  if (
    anyUntracked
  ) {
    return {
      line: {
        ...base,

        reservedQuantityInRequirementUnit:
          reservedQuantity,

        readinessState:
          'needs_confirmation',

        reasonCode:
          'PANTRY_TRACKING_DISABLED',
      },

      reservations,
    }
  }

  if (
    anyUncertain
  ) {
    return {
      line: {
        ...base,

        reservedQuantityInRequirementUnit:
          reservedQuantity,

        readinessState:
          anyRunningLow
            ? 'running_low_before_meal'
            : 'needs_confirmation',

        reasonCode:
          anyRunningLow
            ? 'PANTRY_RUNNING_LOW_NEEDS_CONFIRMATION'
            : 'PANTRY_QUANTITY_UNCERTAIN',
      },

      reservations,
    }
  }

  const provenShortageQuantity =
    roundQuantity(
      remainingRequirement,
    )

  if (
    reservedQuantity >
    0
  ) {
    return {
      line: {
        ...base,

        reservedQuantityInRequirementUnit:
          reservedQuantity,

        provenShortageQuantity,

        readinessState:
          'running_low_before_meal',

        reasonCode:
          'CONFIRMED_PANTRY_PARTIAL_AFTER_RESERVATIONS',
      },

      reservations,
    }
  }

  if (
    anyNumericInitially &&
    !anyNumericRemainingBefore
  ) {
    return {
      line: {
        ...base,

        provenShortageQuantity,

        readinessState:
          'expected_depleted',

        reasonCode:
          'EARLIER_PLANNED_MEALS_RESERVED_AVAILABLE_QUANTITY',
      },

      reservations,
    }
  }

  return {
    line: {
      ...base,

      provenShortageQuantity,

      readinessState:
        anyHardOut ||
        pantryBalances.length ===
          0
          ? 'missing'
          : 'running_low_before_meal',

      reasonCode:
        anyHardOut
          ? 'PANTRY_CONFIRMS_OUT'
          : pantryBalances.length ===
              0
            ? 'NO_PANTRY_OBSERVATION'
            : 'CONFIRMED_PANTRY_INSUFFICIENT',
    },

    reservations,
  }
}

function addShortage(
  map,
  line,
  meal,
) {
  if (
    line.optional ||
    !Number.isFinite(
      line.provenShortageQuantity,
    ) ||
    line.provenShortageQuantity <=
      0 ||
    !line.canonicalIngredientId ||
    !line.requiredUnit
  ) {
    return
  }

  const ingredientId =
    line.canonicalIngredientId

  const existingEntries =
    map.get(
      ingredientId,
    ) ||
    []

  let merged =
    false

  for (
    const entry
    of existingEntries
  ) {
    const converted =
      safePlanningUnitConversion({
        quantity:
          line.provenShortageQuantity,

        fromUnit:
          line.requiredUnit,

        toUnit:
          entry.unit,
      })

    if (
      converted ===
      null
    ) {
      continue
    }

    entry.quantity =
      roundQuantity(
        entry.quantity +
          converted,
      )

    entry.plannedMealIds.push(
      stringifyId(
        meal.id ||
        meal._id,
      ),
    )

    entry.reasonCodes.push(
      line.reasonCode,
    )

    merged =
      true

    break
  }

  if (
    !merged
  ) {
    existingEntries.push({
      canonicalIngredientId:
        ingredientId,

      label:
        line.label,

      quantity:
        roundQuantity(
          line.provenShortageQuantity,
        ),

      unit:
        line.requiredUnit,

      plannedMealIds: [
        stringifyId(
          meal.id ||
          meal._id,
        ),
      ],

      reasonCodes: [
        line.reasonCode,
      ],
    })
  }

  map.set(
    ingredientId,
    existingEntries,
  )
}

export function allocatePlannedMealReservations({
  meals =
    [],
  pantryItems =
    [],
}) {
  const balancesByIngredient =
    new Map()

  for (
    const pantryItem
    of pantryItems
  ) {
    const balance =
      normalizePantryBalance(
        pantryItem,
      )

    if (
      !balance.canonicalIngredientId ||
      !balance.pantryItemId
    ) {
      continue
    }

    const current =
      balancesByIngredient.get(
        balance.canonicalIngredientId,
      ) ||
      []

    current.push(
      balance,
    )

    current.sort(
      (
        left,
        right,
      ) =>
        String(
          left.pantryItemId,
        ).localeCompare(
          String(
            right.pantryItemId,
          ),
        ),
    )

    balancesByIngredient.set(
      balance.canonicalIngredientId,
      current,
    )
  }

  const reservations = []
  const mealForecasts = []
  const shortageMap =
    new Map()

  for (
    const meal
    of sortMeals(
      meals,
    )
  ) {
    if (
      meal.status !==
      'planned'
    ) {
      mealForecasts.push({
        plannedMealId:
          stringifyId(
            meal.id ||
            meal._id,
          ),

        readinessState:
          'enough',

        readinessSummary:
          summarizeReadiness(
            [],
          ),

        forecastLines:
          [],
      })

      continue
    }

    const lines = []

    for (
      const rawRequirement
      of meal.requirements ||
      []
    ) {
      const requirement =
        normalizeRequirement(
          rawRequirement,
        )

      const allocated =
        allocateRequirement({
          requirement,
          meal,
          balancesByIngredient,
        })

      lines.push(
        allocated.line,
      )

      reservations.push(
        ...allocated.reservations,
      )

      addShortage(
        shortageMap,
        allocated.line,
        meal,
      )
    }

    mealForecasts.push({
      plannedMealId:
        stringifyId(
          meal.id ||
          meal._id,
        ),

      readinessState:
        aggregateMealReadiness(
          lines,
        ),

      readinessSummary:
        summarizeReadiness(
          lines,
        ),

      forecastLines:
        lines,
    })
  }

  const shortages = []

  for (
    const entries
    of shortageMap.values()
  ) {
    for (
      const entry
      of entries
    ) {
      shortages.push({
        ...entry,

        plannedMealIds: [
          ...new Set(
            entry.plannedMealIds,
          ),
        ],

        reasonCodes: [
          ...new Set(
            entry.reasonCodes,
          ),
        ],
      })
    }
  }

  shortages.sort(
    (
      left,
      right,
    ) =>
      String(
        left.label ||
        left.canonicalIngredientId,
      ).localeCompare(
        String(
          right.label ||
          right.canonicalIngredientId,
        ),
      ),
  )

  return {
    reservations,
    mealForecasts,
    shortages,
  }
}

export function buildPlanningFingerprint(
  value,
) {
  const normalized =
    JSON.stringify(
      value,
      Object.keys(
        value ||
        {},
      ).sort(),
    )

  return createHash(
    'sha256',
  )
    .update(
      normalized,
      'utf8',
    )
    .digest(
      'hex',
    )
}

export function buildNextBasketPredictionKey({
  householdId,
  canonicalIngredientId,
  classification,
  proposedQuantity,
  evidenceReferences,
}) {
  return createHash(
    'sha256',
  )
    .update(
      JSON.stringify({
        householdId:
          stringifyId(
            householdId,
          ),

        canonicalIngredientId:
          stringifyId(
            canonicalIngredientId,
          ),

        classification,

        proposedQuantity,

        evidenceReferences: [
          ...(
            evidenceReferences ||
            []
          ),
        ].sort(),
      }),
      'utf8',
    )
    .digest(
      'hex',
    )
}