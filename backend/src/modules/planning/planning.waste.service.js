import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  listPantryItems,
  requireCurrentPantryHousehold,
} from '../pantry/pantry.service.js'

import {
  Dish,
  RecipeIngredient,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  safePlanningUnitConversion,
} from './planning.engine.js'

import {
  PantryReservation,
  PlannedMeal,
} from './planning.models.js'

const DAY_MS = 86_400_000
const DEFAULT_HORIZON_DAYS = 7
const MAX_HORIZON_DAYS = 30
const PANTRY_PAGE_SIZE = 100
const MAX_PANTRY_PAGES = 5
const MAX_RECIPE_MATCH_ROWS = 2_000
const MAX_NEXT_POSSIBILITIES = 12

const NON_AVAILABLE_PANTRY_STATES = new Set([
  'out',
  'do_not_track',
])

const CONFIRMED_EXACT_PANTRY_STATES = new Set([
  'confirmed_available',
  'replenished_elsewhere',
])

function stringifyId(value) {
  if (value === null || value === undefined) {
    return null
  }

  return String(value)
}

function asDate(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date
    ? value
    : new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function roundQuantity(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return null
  }

  return Number(numeric.toFixed(6))
}

function uniqueIds(values) {
  return [
    ...new Set(
      (values || [])
        .map(stringifyId)
        .filter(Boolean),
    ),
  ]
}

function compareText(left, right) {
  return String(left || '').localeCompare(
    String(right || ''),
  )
}

function compareDates(left, right) {
  const leftTime = asDate(left)?.getTime()
    ?? Number.MAX_SAFE_INTEGER

  const rightTime = asDate(right)?.getTime()
    ?? Number.MAX_SAFE_INTEGER

  return leftTime - rightTime
}

export function normalizeWasteHorizonDays(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return DEFAULT_HORIZON_DAYS
  }

  return Math.max(
    1,
    Math.min(
      MAX_HORIZON_DAYS,
      Math.floor(numeric),
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Pantry Risk Signal Classification
|--------------------------------------------------------------------------
|
| `useSoonAt` is a Customer-provided use-soon signal. It is NOT treated as
| an expiry date. `running_low` is an at-risk Pantry state, not a spoilage
| claim. No date or quantity is fabricated here.
|
*/

export function classifyPantryRiskSignal({
  pantryItem,
  now = new Date(),
  horizonDays = DEFAULT_HORIZON_DAYS,
}) {
  if (
    !pantryItem ||
    pantryItem.trackingPaused === true ||
    NON_AVAILABLE_PANTRY_STATES.has(pantryItem.state)
  ) {
    return null
  }

  const currentTime = asDate(now)

  if (!currentTime) {
    return null
  }

  const useSoonAt = asDate(pantryItem.useSoonAt)
  const plannedUseAt = asDate(pantryItem.plannedUseAt)

  const boundedHorizonDays = normalizeWasteHorizonDays(
    horizonDays,
  )

  if (useSoonAt) {
    const deltaMs =
      useSoonAt.getTime() -
      currentTime.getTime()

    if (
      deltaMs <=
      boundedHorizonDays * DAY_MS
    ) {
      const daysUntilUseSoon =
        deltaMs <= 0
          ? Math.floor(deltaMs / DAY_MS)
          : Math.ceil(deltaMs / DAY_MS)

      const plannedUseConflict = Boolean(
        plannedUseAt &&
        plannedUseAt > useSoonAt,
      )

      if (deltaMs <= 0) {
        return {
          signalType: 'use_soon',

          priorityClass: 'use_now',

          priorityScore:
            plannedUseConflict
              ? 530
              : 500,

          reasonCode:
            'HOUSEHOLD_USE_SOON_DATE_REACHED',

          confidenceClass: 'high',

          useSoonAt,

          daysUntilUseSoon,

          plannedUseConflict,
        }
      }

      if (
        deltaMs <=
        2 * DAY_MS
      ) {
        return {
          signalType: 'use_soon',

          priorityClass:
            'use_very_soon',

          priorityScore:
            plannedUseConflict
              ? 480
              : 450,

          reasonCode:
            'HOUSEHOLD_USE_SOON_WITHIN_48_HOURS',

          confidenceClass: 'high',

          useSoonAt,

          daysUntilUseSoon,

          plannedUseConflict,
        }
      }

      return {
        signalType: 'use_soon',

        priorityClass: 'use_soon',

        priorityScore:
          plannedUseConflict
            ? 430
            : 400,

        reasonCode:
          'HOUSEHOLD_USE_SOON_WITHIN_HORIZON',

        confidenceClass: 'high',

        useSoonAt,

        daysUntilUseSoon,

        plannedUseConflict,
      }
    }
  }

  if (
    pantryItem.state ===
    'running_low'
  ) {
    const customerConfirmed =
      pantryItem.lastSourceType ===
      'running_low_confirmation'

    return {
      signalType: 'running_low',

      priorityClass: 'attention',

      priorityScore:
        customerConfirmed
          ? 260
          : 240,

      reasonCode:
        customerConfirmed
          ? 'CUSTOMER_CONFIRMED_RUNNING_LOW'
          : 'PANTRY_RUNNING_LOW_STATE',

      confidenceClass:
        customerConfirmed
          ? 'high'
          : 'medium',

      useSoonAt: null,

      daysUntilUseSoon: null,

      plannedUseConflict: false,
    }
  }

  return null
}

/*
|--------------------------------------------------------------------------
| Proven Unreserved Quantity
|--------------------------------------------------------------------------
|
| Exact quantity is exposed only when Pantry already has a confirmed exact
| quantity. Active M13 reservations are converted and subtracted. If any
| reservation cannot be compared safely, the result becomes unknown instead
| of inventing a number.
|
*/

export function calculateProvenUnreservedQuantity({
  pantryItem,
  reservations = [],
}) {
  const quantity =
    pantryItem?.quantity ||
    pantryItem?.quantityEstimate ||
    null

  if (
    !CONFIRMED_EXACT_PANTRY_STATES.has(
      pantryItem?.state,
    ) ||
    quantity?.mode !== 'exact' ||
    !Number.isFinite(
      Number(quantity.value),
    ) ||
    Number(quantity.value) < 0 ||
    !quantity.unit
  ) {
    return {
      mode: 'unknown',

      value: null,

      unit: null,

      reservedQuantity: null,

      activeReservationCount: 0,

      balanceContext:
        'quantity_not_proven',

      reasonCode:
        'CONFIRMED_EXACT_PANTRY_QUANTITY_NOT_AVAILABLE',
    }
  }

  const activeReservations =
    reservations.filter(
      (reservation) =>
        !reservation?.status ||
        reservation.status === 'active',
    )

  let reservedQuantity = 0

  for (
    const reservation
    of activeReservations
  ) {
    const converted =
      safePlanningUnitConversion({
        quantity:
          reservation.reservedQuantity,

        fromUnit:
          reservation.unit,

        toUnit:
          quantity.unit,
      })

    if (converted === null) {
      return {
        mode: 'unknown',

        value: null,

        unit: null,

        reservedQuantity: null,

        activeReservationCount:
          activeReservations.length,

        balanceContext:
          'reservation_units_not_comparable',

        reasonCode:
          'ACTIVE_RESERVATION_UNIT_NOT_COMPARABLE',
      }
    }

    reservedQuantity += converted
  }

  const unreservedQuantity =
    Math.max(
      0,

      Number(quantity.value) -
        reservedQuantity,
    )

  return {
    mode: 'exact',

    value:
      roundQuantity(
        unreservedQuantity,
      ),

    unit:
      quantity.unit,

    reservedQuantity:
      roundQuantity(
        reservedQuantity,
      ),

    activeReservationCount:
      activeReservations.length,

    balanceContext:
      activeReservations.length > 0 &&
      unreservedQuantity > 0
        ? 'confirmed_unreserved_after_planned_meals'
        : activeReservations.length > 0
          ? 'fully_reserved_for_planned_meals'
          : 'confirmed_exact_no_active_reservation',

    reasonCode:
      'CONFIRMED_EXACT_MINUS_ACTIVE_PLANNING_RESERVATIONS',
  }
}

function evaluateBaseRecipeLineCoverage({
  pantryBalance,
  recipeIngredient,
}) {
  const requiredQuantity =
    Number(
      recipeIngredient?.quantity,
    )

  if (
    pantryBalance?.mode !== 'exact' ||
    !Number.isFinite(
      Number(
        pantryBalance.value,
      ),
    ) ||
    !pantryBalance.unit ||
    !Number.isFinite(
      requiredQuantity,
    ) ||
    !recipeIngredient?.unit
  ) {
    return {
      state: 'unknown',

      requiredQuantity:
        Number.isFinite(
          requiredQuantity,
        )
          ? roundQuantity(
              requiredQuantity,
            )
          : null,

      requiredUnit:
        recipeIngredient?.unit ||
        null,

      provenAvailableQuantityInRequiredUnit:
        null,
    }
  }

  const availableInRequiredUnit =
    safePlanningUnitConversion({
      quantity:
        pantryBalance.value,

      fromUnit:
        pantryBalance.unit,

      toUnit:
        recipeIngredient.unit,
    })

  if (
    availableInRequiredUnit ===
    null
  ) {
    return {
      state: 'unknown',

      requiredQuantity:
        roundQuantity(
          requiredQuantity,
        ),

      requiredUnit:
        recipeIngredient.unit,

      provenAvailableQuantityInRequiredUnit:
        null,
    }
  }

  return {
    state:
      availableInRequiredUnit >=
      requiredQuantity
        ? 'enough_for_base_recipe_line'
        : 'below_base_recipe_line',

    requiredQuantity:
      roundQuantity(
        requiredQuantity,
      ),

    requiredUnit:
      recipeIngredient.unit,

    provenAvailableQuantityInRequiredUnit:
      roundQuantity(
        availableInRequiredUnit,
      ),
  }
}

async function loadAllPlanningPantryItems(
  actorUser,
) {
  const items = []

  let page = 1
  let total = null

  while (
    page <=
    MAX_PANTRY_PAGES
  ) {
    const result =
      await listPantryItems(
        {
          page,

          limit:
            PANTRY_PAGE_SIZE,
        },

        actorUser,
      )

    items.push(
      ...(
        result.items ||
        []
      ),
    )

    total =
      result.pagination?.total ??
      items.length

    if (
      page >=
        (
          result.pagination?.pages ||
          1
        ) ||
      items.length >=
        total
    ) {
      break
    }

    page += 1
  }

  return {
    items,

    total:
      total ??
      items.length,

    truncated:
      Number.isFinite(
        Number(total),
      ) &&
      items.length <
        Number(total),
  }
}

async function loadIngredientNameMap(
  ingredientIds,
) {
  const ids =
    uniqueIds(
      ingredientIds,
    )

  if (!ids.length) {
    return new Map()
  }

  const rows =
    await CanonicalIngredient.find({
      _id: {
        $in: ids,
      },
    })
      .select({
        canonicalName: 1,
      })
      .lean()

  return new Map(
    rows.map(
      (row) => [
        stringifyId(
          row._id,
        ),

        row.canonicalName ||
          'Ingredient',
      ],
    ),
  )
}

async function buildPantryRiskSignals({
  actorUser,
  householdId,
  now,
  horizonDays,
}) {
  const pantryResult =
    await loadAllPlanningPantryItems(
      actorUser,
    )

  const classified =
    pantryResult.items
      .map(
        (item) => ({
          item,

          signal:
            classifyPantryRiskSignal({
              pantryItem: item,

              now,

              horizonDays,
            }),
        }),
      )
      .filter(
        (row) =>
          Boolean(
            row.signal,
          ),
      )

  const ingredientNameMap =
    await loadIngredientNameMap(
      classified.map(
        (row) =>
          row.item
            .canonicalIngredientId,
      ),
    )

  const pantryItemIds =
    uniqueIds(
      classified.map(
        (row) =>
          row.item.id,
      ),
    )

  const reservationRows =
    pantryItemIds.length
      ? await PantryReservation.find({
          householdId,

          pantryItemId: {
            $in:
              pantryItemIds,
          },

          status: 'active',
        })
          .sort({
            pantryItemId: 1,

            reservedForDate: 1,

            _id: 1,
          })
          .lean()
      : []

  const reservationsByPantryItem =
    new Map()

  for (
    const reservation
    of reservationRows
  ) {
    const pantryItemId =
      stringifyId(
        reservation.pantryItemId,
      )

    const current =
      reservationsByPantryItem.get(
        pantryItemId,
      ) ||
      []

    current.push(
      reservation,
    )

    reservationsByPantryItem.set(
      pantryItemId,
      current,
    )
  }

  const signals =
    classified
      .map(
        ({
          item,
          signal,
        }) => {
          const pantryItemId =
            stringifyId(
              item.id,
            )

          const canonicalIngredientId =
            stringifyId(
              item.canonicalIngredientId,
            )

          const provenUnreservedQuantity =
            calculateProvenUnreservedQuantity({
              pantryItem:
                item,

              reservations:
                reservationsByPantryItem.get(
                  pantryItemId,
                ) ||
                [],
            })

          return {
            signalKey:
              `${pantryItemId}:${signal.signalType}`,

            pantryItemId,

            canonicalIngredientId,

            ingredientName:
              ingredientNameMap.get(
                canonicalIngredientId,
              ) ||
              'Ingredient',

            pantryState:
              item.state,

            storageZone:
              item.storageZone ||
              null,

            openedAt:
              item.openedAt ||
              null,

            plannedUseAt:
              item.plannedUseAt ||
              null,

            lastObservationAt:
              item.lastObservationAt ||
              null,

            lastSourceType:
              item.lastSourceType ||
              null,

            signalType:
              signal.signalType,

            priorityClass:
              signal.priorityClass,

            priorityScore:
              signal.priorityScore,

            useSoonAt:
              signal.useSoonAt,

            daysUntilUseSoon:
              signal.daysUntilUseSoon,

            plannedUseConflict:
              signal.plannedUseConflict,

            reasonCode:
              signal.reasonCode,

            confidenceClass:
              signal.confidenceClass,

            provenUnreservedQuantity,

            evidenceReferences: [
              `pantryItem:${pantryItemId}`,
            ],

            evidence: {
              source:
                signal.signalType ===
                'use_soon'
                  ? 'customer_use_soon_signal'
                  : 'pantry_running_low_state',

              expiryDate:
                null,

              expiryDateClaimed:
                false,

              spoilageClaimed:
                false,

              leftoverClaimed:
                false,

              genericExcessClaimed:
                false,

              exactQuantityClaimed:
                provenUnreservedQuantity
                  .mode ===
                'exact',
            },
          }
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.priorityScore -
            left.priorityScore ||

          compareDates(
            left.useSoonAt,
            right.useSoonAt,
          ) ||

          compareText(
            left.ingredientName,
            right.ingredientName,
          ) ||

          compareText(
            left.pantryItemId,
            right.pantryItemId,
          ),
      )

  return {
    signals,

    pantryScan: {
      scanned:
        pantryResult.items.length,

      total:
        pantryResult.total,

      truncated:
        pantryResult.truncated,
    },
  }
}

function plannedMealUsesIngredient({
  plannedMeal,
  canonicalIngredientId,
}) {
  return (
    plannedMeal?.forecastLines ||
    []
  ).some(
    (line) =>
      stringifyId(
        line.canonicalIngredientId,
      ) ===
      canonicalIngredientId,
  )
}

async function buildPlannedMealRescueSuggestions({
  householdId,
  riskSignals,
  now,
}) {
  const useSoonSignals =
    riskSignals.filter(
      (signal) =>
        signal.signalType ===
          'use_soon' &&
        signal.useSoonAt,
    )

  if (
    !useSoonSignals.length
  ) {
    return {
      suggestions: [],

      plannedMeals: [],
    }
  }

  const plannedMeals =
    await PlannedMeal.find({
      householdId,

      status: 'planned',

      plannedAt: {
        $gte: now,
      },
    })
      .sort({
        plannedAt: 1,

        priority: -1,

        _id: 1,
      })
      .lean()

  const suggestions = []

  for (
    const signal
    of useSoonSignals
  ) {
    const useSoonAt =
      asDate(
        signal.useSoonAt,
      )

    if (!useSoonAt) {
      continue
    }

    for (
      const plannedMeal
      of plannedMeals
    ) {
      const plannedAt =
        asDate(
          plannedMeal.plannedAt,
        )

      if (
        !plannedAt ||
        plannedAt <=
          useSoonAt ||
        !plannedMealUsesIngredient({
          plannedMeal,

          canonicalIngredientId:
            signal
              .canonicalIngredientId,
        })
      ) {
        continue
      }

      suggestions.push({
        suggestionKey:
          `${plannedMeal._id}:${signal.pantryItemId}`,

        plannedMealId:
          stringifyId(
            plannedMeal._id,
          ),

        mealPlanId:
          stringifyId(
            plannedMeal.mealPlanId,
          ),

        recipeVersionId:
          stringifyId(
            plannedMeal.recipeVersionId,
          ),

        recipeSlug:
          plannedMeal.recipeSlug,

        recipeTitle:
          plannedMeal.recipeTitle,

        plannedAt:
          plannedMeal.plannedAt,

        mealType:
          plannedMeal.mealType,

        servings:
          plannedMeal.servings,

        pantryItemId:
          signal.pantryItemId,

        canonicalIngredientId:
          signal
            .canonicalIngredientId,

        ingredientName:
          signal
            .ingredientName,

        useSoonAt:
          signal.useSoonAt,

        suggestedAction:
          'consider_moving_planned_meal_earlier',

        reasonCode:
          'PLANNED_MEAL_USES_ITEM_AFTER_CUSTOMER_USE_SOON_DATE',

        confidenceClass:
          'high',

        evidenceReferences: [
          `pantryItem:${signal.pantryItemId}`,

          `plannedMeal:${plannedMeal._id}`,

          `recipeVersion:${plannedMeal.recipeVersionId}`,
        ],

        claimBoundary: {
          expiryDateClaimed:
            false,

          spoilageClaimed:
            false,

          automaticReschedule:
            false,
        },
      })
    }
  }

  suggestions.sort(
    (
      left,
      right,
    ) =>
      compareDates(
        left.useSoonAt,
        right.useSoonAt,
      ) ||

      compareDates(
        left.plannedAt,
        right.plannedAt,
      ) ||

      compareText(
        left.recipeTitle,
        right.recipeTitle,
      ) ||

      compareText(
        left.suggestionKey,
        right.suggestionKey,
      ),
  )

  return {
    suggestions,

    plannedMeals,
  }
}

function scoreNextPossibility({
  matchedSignals,
  ingredientMatches,
}) {
  const signalScore =
    matchedSignals.reduce(
      (
        total,
        signal,
      ) =>
        total +
        signal.priorityScore,

      0,
    )

  const provenCoverageBonus =
    ingredientMatches.filter(
      (match) =>
        match
          .baseRecipeLineCoverage
          .state ===
        'enough_for_base_recipe_line',
    ).length *
    35

  const unreservedAfterPlanBonus =
    matchedSignals.filter(
      (signal) =>
        signal
          .provenUnreservedQuantity
          ?.balanceContext ===
        'confirmed_unreserved_after_planned_meals',
    ).length *
    25

  return (
    signalScore +
    matchedSignals.length * 20 +
    provenCoverageBonus +
    unreservedAfterPlanBonus
  )
}

async function buildNextPossibilities({
  riskSignals,
  plannedMeals,
  now,
}) {
  const useSoonSignals =
    riskSignals.filter(
      (signal) =>
        signal.signalType ===
          'use_soon' &&

        signal
          .canonicalIngredientId &&

        !(
          signal
            .provenUnreservedQuantity
            ?.mode ===
            'exact' &&

          signal
            .provenUnreservedQuantity
            ?.value <=
            0
        ),
    )

  const ingredientIds =
    uniqueIds(
      useSoonSignals.map(
        (signal) =>
          signal
            .canonicalIngredientId,
      ),
    )

  if (!ingredientIds.length) {
    return {
      items: [],

      recipeMatchScan: {
        scannedIngredientRows: 0,

        totalIngredientRows: 0,

        truncated: false,
      },
    }
  }

  const recipeIngredientFilter = {
    canonicalIngredientId: {
      $in:
        ingredientIds,
    },
  }

  const [
    ingredientRows,
    totalIngredientRows,
  ] =
    await Promise.all([
      RecipeIngredient.find(
        recipeIngredientFilter,
      )
        .sort({
          recipeVersionId: 1,

          lineNumber: 1,

          _id: 1,
        })
        .limit(
          MAX_RECIPE_MATCH_ROWS,
        )
        .lean(),

      RecipeIngredient.countDocuments(
        recipeIngredientFilter,
      ),
    ])

  const rowsByRecipeVersion =
    new Map()

  for (
    const row
    of ingredientRows
  ) {
    const recipeVersionId =
      stringifyId(
        row.recipeVersionId,
      )

    const current =
      rowsByRecipeVersion.get(
        recipeVersionId,
      ) ||
      []

    current.push(
      row,
    )

    rowsByRecipeVersion.set(
      recipeVersionId,
      current,
    )
  }

  const matchingRecipeVersionIds = [
    ...rowsByRecipeVersion.keys(),
  ]

  if (
    !matchingRecipeVersionIds.length
  ) {
    return {
      items: [],

      recipeMatchScan: {
        scannedIngredientRows:
          ingredientRows.length,

        totalIngredientRows,

        truncated:
          ingredientRows.length <
          totalIngredientRows,
      },
    }
  }

  const matchingRecipeVersions =
    await RecipeVersion.find({
      _id: {
        $in:
          matchingRecipeVersionIds,
      },
    })
      .select({
        dishId: 1,
      })
      .lean()

  const candidateDishIds =
    uniqueIds(
      matchingRecipeVersions.map(
        (version) =>
          version.dishId,
      ),
    )

  const currentRecipeVersions =
    candidateDishIds.length
      ? await RecipeVersion.find({
          dishId: {
            $in:
              candidateDishIds,
          },

          status:
            'published',

          unsafeIncomplete: {
            $ne: true,
          },

          effectiveFrom: {
            $lte: now,
          },

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
        })
          .sort({
            dishId: 1,

            versionNumber: -1,

            _id: 1,
          })
          .lean()
      : []

  const currentVersionByDish =
    new Map()

  for (
    const version
    of currentRecipeVersions
  ) {
    const dishId =
      stringifyId(
        version.dishId,
      )

    if (
      !currentVersionByDish.has(
        dishId,
      )
    ) {
      currentVersionByDish.set(
        dishId,
        version,
      )
    }
  }

  const dishIds = [
    ...currentVersionByDish.keys(),
  ]

  const dishes =
    dishIds.length
      ? await Dish.find({
          _id: {
            $in: dishIds,
          },

          status:
            'active',
        })
          .select({
            name: 1,

            slug: 1,

            heroImageUrl: 1,

            cuisine: 1,

            course: 1,
          })
          .lean()
      : []

  const dishMap =
    new Map(
      dishes.map(
        (dish) => [
          stringifyId(
            dish._id,
          ),

          dish,
        ],
      ),
    )

  const signalsByIngredient =
    new Map()

  for (
    const signal
    of useSoonSignals
  ) {
    const current =
      signalsByIngredient.get(
        signal
          .canonicalIngredientId,
      ) ||
      []

    current.push(
      signal,
    )

    signalsByIngredient.set(
      signal.canonicalIngredientId,
      current,
    )
  }

  const plannedDishIds =
    new Set(
      plannedMeals.map(
        (meal) =>
          stringifyId(
            meal.dishId,
          ),
      ),
    )

  const possibilities = []

  for (
    const [
      dishId,
      recipeVersion,
    ]
    of currentVersionByDish
  ) {
    if (
      plannedDishIds.has(
        dishId,
      )
    ) {
      continue
    }

    const dish =
      dishMap.get(
        dishId,
      )

    if (!dish) {
      continue
    }

    const recipeVersionId =
      stringifyId(
        recipeVersion._id,
      )

    const matchedRows =
      rowsByRecipeVersion.get(
        recipeVersionId,
      ) ||
      []

    /*
    |--------------------------------------------------------------------------
    | Current Recipe Truth Only
    |--------------------------------------------------------------------------
    |
    | An older RecipeVersion may contain the use-soon ingredient while the
    | current published version no longer contains it.
    |
    | Never recommend from stale recipe truth.
    |
    */

    if (!matchedRows.length) {
      continue
    }

    const matchedSignalsByPantryItem =
      new Map()

    const ingredientMatches = []

    for (
      const row
      of matchedRows
    ) {
      const canonicalIngredientId =
        stringifyId(
          row.canonicalIngredientId,
        )

      const signals =
        signalsByIngredient.get(
          canonicalIngredientId,
        ) ||
        []

      for (
        const signal
        of signals
      ) {
        if (
          matchedSignalsByPantryItem.has(
            signal.pantryItemId,
          )
        ) {
          continue
        }

        matchedSignalsByPantryItem.set(
          signal.pantryItemId,
          signal,
        )

        ingredientMatches.push({
          pantryItemId:
            signal.pantryItemId,

          canonicalIngredientId,

          ingredientName:
            signal.ingredientName,

          useSoonAt:
            signal.useSoonAt,

          priorityClass:
            signal.priorityClass,

          recipeIngredientOptional:
            row.optional === true,

          recipeIngredientRole:
            row.role ||
            null,

          provenUnreservedQuantity:
            signal
              .provenUnreservedQuantity,

          baseRecipeLineCoverage:
            evaluateBaseRecipeLineCoverage({
              pantryBalance:
                signal
                  .provenUnreservedQuantity,

              recipeIngredient:
                row,
            }),
        })
      }
    }

    const matchedSignals = [
      ...matchedSignalsByPantryItem.values(),
    ]

    if (!matchedSignals.length) {
      continue
    }

    const hasProvenBaseLineCoverage =
      ingredientMatches.some(
        (match) =>
          match
            .baseRecipeLineCoverage
            .state ===
          'enough_for_base_recipe_line',
      )

    const hasConfirmedUnreservedAfterPlan =
      matchedSignals.some(
        (signal) =>
          signal
            .provenUnreservedQuantity
            ?.balanceContext ===
          'confirmed_unreserved_after_planned_meals',
      )

    possibilities.push({
      possibilityKey:
        `${dishId}:${recipeVersionId}`,

      dishId,

      recipeVersionId,

      recipeSlug:
        dish.slug,

      recipeTitle:
        recipeVersion.title ||
        dish.name,

      heroImageUrl:
        dish.heroImageUrl ||
        null,

      cuisine:
        dish.cuisine ||
        null,

      course:
        dish.course ||
        null,

      baseServings:
        recipeVersion.baseServings,

      preparationTimeMinutes:
        recipeVersion
          .preparationTimeMinutes ??
        null,

      cookingTimeMinutes:
        recipeVersion
          .cookingTimeMinutes ??
        null,

      score:
        scoreNextPossibility({
          matchedSignals,

          ingredientMatches,
        }),

      confidenceClass:
        hasProvenBaseLineCoverage ||
        hasConfirmedUnreservedAfterPlan
          ? 'high'
          : 'medium',

      reasonCode:
        hasConfirmedUnreservedAfterPlan
          ? 'USE_SOON_RECIPE_MATCH_WITH_CONFIRMED_UNRESERVED_PLANNED_BALANCE'
          : hasProvenBaseLineCoverage
            ? 'USE_SOON_RECIPE_MATCH_WITH_PROVEN_BASE_LINE_COVERAGE'
            : 'USE_SOON_RECIPE_IDENTITY_MATCH',

      matchedIngredients:
        ingredientMatches,

      evidenceReferences: [
        `recipeVersion:${recipeVersionId}`,

        ...matchedSignals.map(
          (signal) =>
            `pantryItem:${signal.pantryItemId}`,
        ),
      ],

      evidence: {
        deterministic:
          true,

        publishedRecipeVersion:
          true,

        customerUseSoonSignalMatched:
          true,

        confirmedUnreservedBalanceAfterPlannedMeals:
          hasConfirmedUnreservedAfterPlan,

        provenBaseRecipeLineCoverage:
          hasProvenBaseLineCoverage,
      },

      claimBoundary: {
        expiryDateClaimed:
          false,

        spoilageClaimed:
          false,

        leftoverClaimed:
          false,

        genericExcessClaimed:
          false,

        entireRecipePantryCoverageClaimed:
          false,

        automaticMealPlanChange:
          false,

        automaticPurchase:
          false,
      },
    })
  }

  return {
    items:
      possibilities
        .sort(
          (
            left,
            right,
          ) =>
            right.score -
              left.score ||

            compareText(
              left.recipeTitle,
              right.recipeTitle,
            ) ||

            compareText(
              left.possibilityKey,
              right.possibilityKey,
            ),
        )
        .slice(
          0,
          MAX_NEXT_POSSIBILITIES,
        ),

    recipeMatchScan: {
      scannedIngredientRows:
        ingredientRows.length,

      totalIngredientRows,

      truncated:
        ingredientRows.length <
        totalIngredientRows,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Public Part 3 Service Surfaces
|--------------------------------------------------------------------------
*/

export async function getWasteReduction({
  actorUser,
  now = new Date(),
  horizonDays = DEFAULT_HORIZON_DAYS,
}) {
  const currentTime =
    asDate(now) ||
    new Date()

  const boundedHorizonDays =
    normalizeWasteHorizonDays(
      horizonDays,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const riskResult =
    await buildPantryRiskSignals({
      actorUser,

      householdId,

      now:
        currentTime,

      horizonDays:
        boundedHorizonDays,
    })

  const rescueResult =
    await buildPlannedMealRescueSuggestions({
      householdId,

      riskSignals:
        riskResult.signals,

      now:
        currentTime,
    })

  const possibilityResult =
    await buildNextPossibilities({
      riskSignals:
        riskResult.signals,

      plannedMeals:
        rescueResult.plannedMeals,

      now:
        currentTime,
    })

  const useSoonSignals =
    riskResult.signals.filter(
      (signal) =>
        signal.signalType ===
        'use_soon',
    )

  const runningLowSignals =
    riskResult.signals.filter(
      (signal) =>
        signal.signalType ===
        'running_low',
    )

  return {
    generatedAt:
      currentTime,

    horizonDays:
      boundedHorizonDays,

    atRiskPantrySignals:
      riskResult.signals,

    plannedMealRescues:
      rescueResult.suggestions,

    nextPossibilities:
      possibilityResult.items,

    summary: {
      totalAtRiskSignals:
        riskResult
          .signals
          .length,

      useSoonSignals:
        useSoonSignals.length,

      runningLowSignals:
        runningLowSignals.length,

      plannedUseConflicts:
        useSoonSignals.filter(
          (signal) =>
            signal
              .plannedUseConflict ===
            true,
        ).length,

      plannedMealRescues:
        rescueResult
          .suggestions
          .length,

      nextPossibilities:
        possibilityResult
          .items
          .length,

      confirmedUnreservedAfterPlannedMeals:
        useSoonSignals.filter(
          (signal) =>
            signal
              .provenUnreservedQuantity
              ?.balanceContext ===
            'confirmed_unreserved_after_planned_meals',
        ).length,
    },

    scanPolicy: {
      pantry:
        riskResult.pantryScan,

      recipeMatches:
        possibilityResult
          .recipeMatchScan,
    },

    evidencePolicy: {
      deterministic:
        true,

      customerUseSoonIsNotExpiry:
        true,

      inferredExpiryDates:
        false,

      inferredSpoilage:
        false,

      inventedQuantities:
        false,

      explicitLeftoverStateAvailable:
        false,

      leftoverClaims:
        false,

      genericExcessClaims:
        false,

      excessAwarenessBasis:
        'Only confirmed exact Pantry balance remaining after active planned-meal reservations is exposed as unreserved balance.',

      confidenceIsQualitativeEvidenceClass:
        true,
    },

    automaticMealPlanChange:
      false,

    automaticPurchase:
      false,
  }
}

export async function getNextPossibility({
  actorUser,
  now = new Date(),
  horizonDays = DEFAULT_HORIZON_DAYS,
}) {
  const wasteReduction =
    await getWasteReduction({
      actorUser,

      now,

      horizonDays,
    })

  return {
    generatedAt:
      wasteReduction.generatedAt,

    horizonDays:
      wasteReduction.horizonDays,

    items:
      wasteReduction
        .nextPossibilities,

    summary: {
      total:
        wasteReduction
          .nextPossibilities
          .length,

      useSoonSignalsConsidered:
        wasteReduction
          .summary
          .useSoonSignals,

      plannedMealRescuesAvailable:
        wasteReduction
          .summary
          .plannedMealRescues,
    },

    scanPolicy:
      wasteReduction.scanPolicy,

    evidencePolicy:
      wasteReduction.evidencePolicy,

    automaticMealPlanChange:
      false,

    automaticPurchase:
      false,
  }
}