import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Brand,
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  createCustomerPantryObservation,
  listPantryItems,
  requireCurrentPantryHousehold,
} from '../pantry/pantry.service.js'

import {
  RecipeIngredient,
  RecipeSubstitution,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  getPublicRecipe,
} from '../recipes/recipe.public.service.js'

import {
  scaleRecipeAggregate,
} from '../recipes/recipe.scaling.js'

import {
  allocatePlannedMealReservations,
  buildNextBasketPredictionKey,
} from './planning.engine.js'

import {
  MealPlan,
  NextBasketPrediction,
  PantryReservation,
  PlannedMeal,
  RecommendationFeedback,
  RecommendationPreference,
} from './planning.models.js'

function stringifyId(
  value,
) {
  return value ===
    null ||
    value ===
      undefined
    ? null
    : String(
        value,
      )
}

function actorIdFromUser(
  actorUser,
) {
  const id =
    actorUser?._id ||
    actorUser?.id

  if (!id) {
    throw new ApiError(
      401,
      'Authenticated Customer identity is required.',
      [
        {
          code:
            'PLANNING_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return id
}

function asPlainObject(
  value,
) {
  return typeof value
    ?.toObject ===
    'function'
    ? value.toObject()
    : value
}

function normalizeDate(
  value,
) {
  const date =
    value instanceof
    Date
      ? value
      : new Date(
          value,
        )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

function defaultHorizon() {
  const start =
    new Date()

  start.setHours(
    0,
    0,
    0,
    0,
  )

  const end =
    new Date(
      start,
    )

  end.setDate(
    end.getDate() +
      7,
  )

  end.setHours(
    23,
    59,
    59,
    999,
  )

  return {
    start,
    end,
  }
}

function assertHorizon({
  start,
  end,
}) {
  if (
    !start ||
    !end ||
    end <=
      start
  ) {
    throw new ApiError(
      400,
      'Meal Plan horizon end must be after horizon start.',
      [
        {
          code:
            'MEAL_PLAN_HORIZON_INVALID',
        },
      ],
    )
  }

  const days =
    (
      end.getTime() -
      start.getTime()
    ) /
    86_400_000

  if (
    days >
    90
  ) {
    throw new ApiError(
      400,
      'Meal Plan horizon cannot exceed 90 days.',
      [
        {
          code:
            'MEAL_PLAN_HORIZON_TOO_LARGE',
        },
      ],
    )
  }
}

function serializeMealPlan(
  value,
) {
  const row =
    asPlainObject(
      value,
    )

  return {
    id:
      stringifyId(
        row._id ||
        row.id,
      ),

    title:
      row.title,

    horizonStart:
      row.horizonStart,

    horizonEnd:
      row.horizonEnd,

    status:
      row.status,

    createdAt:
      row.createdAt ||
      null,

    updatedAt:
      row.updatedAt ||
      null,
  }
}

function serializeForecastLine(
  line,
) {
  const value =
    asPlainObject(
      line,
    ) ||
    {}

  return {
    canonicalIngredientId:
      stringifyId(
        value.canonicalIngredientId,
      ),

    label:
      value.label ||
      null,

    optional:
      value.optional ===
      true,

    requiredQuantity:
      value.requiredQuantity ??
      null,

    requiredUnit:
      value.requiredUnit ||
      null,

    reservedQuantityInRequirementUnit:
      value.reservedQuantityInRequirementUnit ??
      0,

    provenShortageQuantity:
      value.provenShortageQuantity ??
      null,

    readinessState:
      value.readinessState ||
      'needs_confirmation',

    reasonCode:
      value.reasonCode ||
      'PLANNING_REQUIREMENT_CANNOT_BE_VERIFIED',
  }
}

function serializePlannedMeal(
  value,
) {
  const row =
    asPlainObject(
      value,
    )

  return {
    id:
      stringifyId(
        row._id ||
        row.id,
      ),

    mealPlanId:
      stringifyId(
        row.mealPlanId,
      ),

    dishId:
      stringifyId(
        row.dishId,
      ),

    recipeVersionId:
      stringifyId(
        row.recipeVersionId,
      ),

    recipeSlug:
      row.recipeSlug,

    recipeTitle:
      row.recipeTitle,

    plannedAt:
      row.plannedAt,

    mealType:
      row.mealType,

    servings:
      row.servings,

    priority:
      row.priority,

    status:
      row.status,

    readinessState:
      row.readinessState,

    readinessSummary:
      row.readinessSummary ||
      {},

    forecastLines:
      (
        row.forecastLines ||
        []
      ).map(
        serializeForecastLine,
      ),

    lastCalculatedAt:
      row.lastCalculatedAt ||
      null,

    createdAt:
      row.createdAt ||
      null,

    updatedAt:
      row.updatedAt ||
      null,
  }
}

function serializeReservation(
  value,
) {
  const row =
    asPlainObject(
      value,
    )

  return {
    id:
      stringifyId(
        row._id ||
        row.id,
      ),

    pantryItemId:
      stringifyId(
        row.pantryItemId,
      ),

    plannedMealId:
      stringifyId(
        row.plannedMealId,
      ),

    canonicalIngredientId:
      stringifyId(
        row.canonicalIngredientId,
      ),

    reservedQuantity:
      row.reservedQuantity,

    unit:
      row.unit,

    reservationBasis:
      row.reservationBasis,

    reservedForDate:
      row.reservedForDate,

    status:
      row.status,
  }
}

function serializePrediction(
  value,
) {
  const row =
    asPlainObject(
      value,
    )

  return {
    id:
      stringifyId(
        row._id ||
        row.id,
      ),

    canonicalIngredientId:
      stringifyId(
        row.canonicalIngredientId,
      ),

    ingredientName:
      row.ingredientName,

    classification:
      row.classification,

    proposedQuantity:
      row.customerAdjustedQuantity ||
      row.proposedQuantity,

    generatedQuantity:
      row.proposedQuantity,

    confidenceClass:
      row.confidenceClass,

    reasonCode:
      row.reasonCode,

    reasonParameters:
      row.reasonParameters ||
      {},

    evidenceReferences:
      row.evidenceReferences ||
      [],

    preferredBrandId:
      stringifyId(
        row.preferredBrandId,
      ),

    status:
      row.status,

    snoozedUntil:
      row.snoozedUntil ||
      null,

    generatedAt:
      row.generatedAt ||
      null,

    lastEvaluatedAt:
      row.lastEvaluatedAt ||
      null,
  }
}

function serializeFeedback(
  value,
) {
  const row =
    asPlainObject(
      value,
    )

  return {
    id:
      stringifyId(
        row._id ||
        row.id,
      ),

    nextBasketPredictionId:
      stringifyId(
        row.nextBasketPredictionId,
      ),

    canonicalIngredientId:
      stringifyId(
        row.canonicalIngredientId,
      ),

    action:
      row.action,

    quantity:
      row.quantity ||
      null,

    brandId:
      stringifyId(
        row.brandId,
      ),

    snoozeUntil:
      row.snoozeUntil ||
      null,

    note:
      row.note ||
      null,

    recordedAt:
      row.recordedAt ||
      null,
  }
}

function serializePreference(
  value,
) {
  const row =
    asPlainObject(
      value,
    ) ||
    {}

  return {
    nextBasketEnabled:
      row.nextBasketEnabled !==
      false,

    pausedUntil:
      row.pausedUntil ||
      null,

    notificationFrequency:
      row.notificationFrequency ||
      'important_only',
  }
}

async function requirePlanningHousehold(
  actorUser,
) {
  return requireCurrentPantryHousehold(
    actorUser,
  )
}

async function requireOwnedMealPlan({
  mealPlanId,
  householdId,
}) {
  const plan =
    await MealPlan.findOne({
      _id:
        mealPlanId,

      householdId,
    })

  if (!plan) {
    throw new ApiError(
      404,
      'Meal Plan was not found.',
      [
        {
          code:
            'MEAL_PLAN_NOT_FOUND',
        },
      ],
    )
  }

  return plan
}

async function requireOwnedPlannedMeal({
  plannedMealId,
  householdId,
}) {
  const meal =
    await PlannedMeal.findOne({
      _id:
        plannedMealId,

      householdId,
    })

  if (!meal) {
    throw new ApiError(
      404,
      'Planned Meal was not found.',
      [
        {
          code:
            'PLANNED_MEAL_NOT_FOUND',
        },
      ],
    )
  }

  return meal
}

async function loadScaledRequirementsForMeal(
  meal,
) {
  const recipeVersion =
    await RecipeVersion.findOne({
      _id:
        meal.recipeVersionId,

      dishId:
        meal.dishId,

      status: {
        $in: [
          'published',
          'retired',
        ],
      },
    }).lean()

  if (
    !recipeVersion
  ) {
    return {
      available:
        false,

      requirements:
        [],
    }
  }

  const [
    ingredients,
    substitutions,
  ] =
    await Promise.all([
      RecipeIngredient.find({
        recipeVersionId:
          recipeVersion._id,
      })
        .sort({
          lineNumber:
            1,
        })
        .lean(),

      RecipeSubstitution.find({
        recipeVersionId:
          recipeVersion._id,
      })
        .sort({
          priority:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  const scaled =
    scaleRecipeAggregate({
      recipeVersion,

      ingredients,

      substitutions,

      targetServings:
        meal.servings,
    })

  const rows =
    scaled?.ingredients ||
    scaled?.scaledIngredients ||
    scaled?.requirements ||
    []

  const ingredientNameMap =
    await loadIngredientNameMap(
      rows.map(
        (
          row,
        ) =>
          row.canonicalIngredientId ||
          row.ingredientId,
      ),
    )

  return {
    available:
      true,

    requirements:
      rows.map(
        (
          row,
        ) => ({
          canonicalIngredientId:
            stringifyId(
              row.canonicalIngredientId ||
              row.ingredientId,
            ),

          quantity:
            row.scaledQuantity ??
            row.quantity ??
            row.requirementQuantity,

          unit:
            row.scaledUnit ||
            row.unit ||
            row.requirementUnit,

          optional:
            row.optional ===
              true ||
            row.isOptional ===
              true,

          label:
            row.label ||
            row.ingredientName ||
            row.name ||
            ingredientNameMap.get(
              stringifyId(
                row.canonicalIngredientId ||
                row.ingredientId,
              ),
            ) ||
            null,
        }),
      ),
  }
}

async function loadPlanningPantry(
  actorUser,
) {
  const result =
    await listPantryItems(
      {
        page:
          1,

        limit:
          100,
      },
      actorUser,
    )

  return result.items ||
    []
}

export async function recalculateHouseholdPlanning({
  actorUser,
  now =
    new Date(),
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const mealDocs =
    await PlannedMeal.find({
      householdId,

      status: {
        $in: [
          'planned',
          'skipped',
          'cancelled',
        ],
      },
    })
      .sort({
        plannedAt:
          1,

        priority:
          -1,

        _id:
          1,
      })
      .lean()

  const mealsForEngine =
    []

  const unavailableMealIds =
    new Set()

  for (
    const meal
    of mealDocs
  ) {
    const bundle =
      await loadScaledRequirementsForMeal(
        meal,
      )

    if (
      meal.status ===
        'planned' &&
      !bundle.available
    ) {
      unavailableMealIds.add(
        stringifyId(
          meal._id,
        ),
      )
    }

    mealsForEngine.push({
      ...meal,

      id:
        stringifyId(
          meal._id,
        ),

      requirements:
        bundle.requirements,
    })
  }

  const pantryItems =
    await loadPlanningPantry(
      actorUser,
    )

  const calculation =
    allocatePlannedMealReservations({
      meals:
        mealsForEngine,

      pantryItems,
    })

  for (
    const forecast
    of calculation.mealForecasts
  ) {
    if (
      unavailableMealIds.has(
        forecast.plannedMealId,
      )
    ) {
      forecast.readinessState =
        'needs_confirmation'

      forecast.readinessSummary = {
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
          1,
      }

      forecast.forecastLines =
        []
    }
  }

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        /*
        |--------------------------------------------------------------------------
        | Release old overlay
        |--------------------------------------------------------------------------
        |
        | Planning history is retained. M09 Pantry truth is never deleted or
        | rewritten by M13.
        |
        */

        await PantryReservation.updateMany(
          {
            householdId,

            status:
              'active',
          },
          {
            $set: {
              status:
                'released',

              releasedAt:
                now,
            },
          },
          {
            session,
          },
        )

        if (
          calculation
            .reservations
            .length >
          0
        ) {
          await PantryReservation.insertMany(
            calculation.reservations.map(
              (
                reservation,
              ) => ({
                ...reservation,

                householdId,

                status:
                  'active',
              }),
            ),
            {
              session,
            },
          )
        }

        for (
          const forecast
          of calculation.mealForecasts
        ) {
          await PlannedMeal.updateOne(
            {
              _id:
                forecast.plannedMealId,

              householdId,
            },
            {
              $set: {
                readinessState:
                  forecast.readinessState,

                readinessSummary:
                  forecast.readinessSummary,

                forecastLines:
                  forecast.forecastLines,

                lastCalculatedAt:
                  now,
              },
            },
            {
              session,

              runValidators:
                true,
            },
          )
        }
      },
    )
  } finally {
    await session.endSession()
  }

  return {
    householdId:
      stringifyId(
        householdId,
      ),

    mealForecasts:
      calculation.mealForecasts,

    shortages:
      calculation.shortages,

    reservations:
      calculation.reservations,

    calculatedAt:
      now,
  }
}

export async function createMealPlan({
  input,
  idempotencyKey,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const existing =
    await MealPlan.findOne({
      householdId,

      idempotencyKey,
    })

  if (existing) {
    return {
      mealPlan:
        serializeMealPlan(
          existing,
        ),

      idempotentReplay:
        true,
    }
  }

  const defaults =
    defaultHorizon()

  const horizonStart =
    normalizeDate(
      input.horizonStart,
    ) ||
    defaults.start

  const horizonEnd =
    normalizeDate(
      input.horizonEnd,
    ) ||
    defaults.end

  assertHorizon({
    start:
      horizonStart,

    end:
      horizonEnd,
  })

  const created =
    await MealPlan.create({
      householdId,

      createdByUserId:
        actorUserId,

      title:
        input.title ||
        'Meal Plan',

      horizonStart,

      horizonEnd,

      status:
        'active',

      idempotencyKey,
    })

  return {
    mealPlan:
      serializeMealPlan(
        created,
      ),

    idempotentReplay:
      false,
  }
}

export async function listMealPlans({
  actorUser,
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  await recalculateHouseholdPlanning({
    actorUser,
  })

  const plans =
    await MealPlan.find({
      householdId,

      status:
        'active',
    })
      .sort({
        horizonStart:
          1,

        createdAt:
          -1,
      })
      .lean()

  const planIds =
    plans.map(
      (
        plan,
      ) =>
        plan._id,
    )

  const meals =
    planIds.length
      ? await PlannedMeal.find({
          householdId,

          mealPlanId: {
            $in:
              planIds,
          },
        })
          .sort({
            plannedAt:
              1,

            priority:
              -1,

            _id:
              1,
          })
          .lean()
      : []

  const mealsByPlan =
    new Map()

  for (
    const meal
    of meals
  ) {
    const key =
      stringifyId(
        meal.mealPlanId,
      )

    const current =
      mealsByPlan.get(
        key,
      ) ||
      []

    current.push(
      serializePlannedMeal(
        meal,
      ),
    )

    mealsByPlan.set(
      key,
      current,
    )
  }

  return {
    mealPlans:
      plans.map(
        (
          plan,
        ) => ({
          ...serializeMealPlan(
            plan,
          ),

          meals:
            mealsByPlan.get(
              stringifyId(
                plan._id,
              ),
            ) ||
            [],
        }),
      ),
  }
}

export async function deleteMealPlan({
  mealPlanId,
  actorUser,
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const plan =
    await requireOwnedMealPlan({
      mealPlanId,

      householdId,
    })

  if (
    plan.status ===
    'archived'
  ) {
    return {
      mealPlanId:
        stringifyId(
          plan._id,
        ),

      deleted:
        true,

      alreadyDeleted:
        true,
    }
  }

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        await MealPlan.updateOne(
          {
            _id:
              plan._id,

            householdId,
          },
          {
            $set: {
              status:
                'archived',
            },
          },
          {
            session,
          },
        )

        await PlannedMeal.updateMany(
          {
            householdId,

            mealPlanId:
              plan._id,

            status:
              'planned',
          },
          {
            $set: {
              status:
                'cancelled',
            },
          },
          {
            session,
          },
        )
      },
    )
  } finally {
    await session.endSession()
  }

  await recalculateHouseholdPlanning({
    actorUser,
  })

  return {
    mealPlanId:
      stringifyId(
        plan._id,
      ),

    deleted:
      true,

    alreadyDeleted:
      false,
  }
}

export async function getMealPlan({
  mealPlanId,
  actorUser,
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  await recalculateHouseholdPlanning({
    actorUser,
  })

  const plan =
    await requireOwnedMealPlan({
      mealPlanId,

      householdId,
    })

  const [
    meals,
    reservations,
  ] =
    await Promise.all([
      PlannedMeal.find({
        householdId,

        mealPlanId:
          plan._id,
      })
        .sort({
          plannedAt:
            1,

          priority:
            -1,

          _id:
            1,
        })
        .lean(),

      PantryReservation.find({
        householdId,

        status:
          'active',
      })
        .sort({
          reservedForDate:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  const mealIds =
    new Set(
      meals.map(
        (
          meal,
        ) =>
          stringifyId(
            meal._id,
          ),
      ),
    )

  return {
    mealPlan:
      serializeMealPlan(
        plan,
      ),

    meals:
      meals.map(
        serializePlannedMeal,
      ),

    reservations:
      reservations
        .filter(
          (
            reservation,
          ) =>
            mealIds.has(
              stringifyId(
                reservation.plannedMealId,
              ),
            ),
        )
        .map(
          serializeReservation,
        ),
  }
}

export async function addPlannedMeal({
  mealPlanId,
  input,
  idempotencyKey,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const plan =
    await requireOwnedMealPlan({
      mealPlanId,

      householdId,
    })

  if (
    plan.status !==
    'active'
  ) {
    throw new ApiError(
      409,
      'Only an active Meal Plan can receive planned meals.',
      [
        {
          code:
            'MEAL_PLAN_NOT_ACTIVE',
        },
      ],
    )
  }

  const existing =
    await PlannedMeal.findOne({
      householdId,

      idempotencyKey,
    })

  if (existing) {
    return {
      plannedMeal:
        serializePlannedMeal(
          existing,
        ),

      idempotentReplay:
        true,
    }
  }

  const recipe =
    await getPublicRecipe(
      input.recipeSlug,
    )

  const plannedAt =
    normalizeDate(
      input.plannedAt,
    )

  if (!plannedAt) {
    throw new ApiError(
      400,
      'A valid planned meal date is required.',
      [
        {
          code:
            'PLANNED_MEAL_DATE_INVALID',
        },
      ],
    )
  }

  if (
    plannedAt <
      plan.horizonStart ||
    plannedAt >
      plan.horizonEnd
  ) {
    throw new ApiError(
      400,
      'Planned Meal must fall inside the Meal Plan horizon.',
      [
        {
          code:
            'PLANNED_MEAL_OUTSIDE_HORIZON',
        },
      ],
    )
  }

  const created =
    await PlannedMeal.create({
      householdId,

      mealPlanId:
        plan._id,

      dishId:
        recipe.dish.id,

      recipeVersionId:
        recipe.recipe.id,

      recipeSlug:
        recipe.dish.slug,

      recipeTitle:
        recipe.dish.name ||
        recipe.recipe.title,

      plannedAt,

      mealType:
        input.mealType,

      servings:
        input.servings,

      priority:
        input.priority,

      status:
        'planned',

      idempotencyKey,

      createdByUserId:
        actorUserId,
    })

  await recalculateHouseholdPlanning({
    actorUser,
  })

  const refreshed =
    await PlannedMeal.findOne({
      _id:
        created._id,

      householdId,
    }).lean()

  return {
    plannedMeal:
      serializePlannedMeal(
        refreshed,
      ),

    idempotentReplay:
      false,
  }
}

export async function updatePlannedMeal({
  plannedMealId,
  input,
  actorUser,
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const meal =
    await requireOwnedPlannedMeal({
      plannedMealId,

      householdId,
    })

  const plan =
    await requireOwnedMealPlan({
      mealPlanId:
        meal.mealPlanId,

      householdId,
    })

  if (
    input.plannedAt
  ) {
    const plannedAt =
      normalizeDate(
        input.plannedAt,
      )

    if (
      !plannedAt ||
      plannedAt <
        plan.horizonStart ||
      plannedAt >
        plan.horizonEnd
    ) {
      throw new ApiError(
        400,
        'Updated planned meal date must remain inside the Meal Plan horizon.',
        [
          {
            code:
              'PLANNED_MEAL_OUTSIDE_HORIZON',
          },
        ],
      )
    }

    meal.plannedAt =
      plannedAt
  }

  if (
    input.servings !==
    undefined
  ) {
    meal.servings =
      input.servings
  }

  if (
    input.mealType !==
    undefined
  ) {
    meal.mealType =
      input.mealType
  }

  if (
    input.priority !==
    undefined
  ) {
    meal.priority =
      input.priority
  }

  if (
    input.status !==
    undefined
  ) {
    meal.status =
      input.status
  }

  await meal.save()

  await recalculateHouseholdPlanning({
    actorUser,
  })

  const refreshed =
    await PlannedMeal.findOne({
      _id:
        meal._id,

      householdId,
    }).lean()

  return {
    plannedMeal:
      serializePlannedMeal(
        refreshed,
      ),
  }
}

async function loadIngredientNameMap(
  ingredientIds,
) {
  const normalized = [
    ...new Set(
      (
        ingredientIds ||
        []
      )
        .map(
          stringifyId,
        )
        .filter(
          Boolean,
        ),
    ),
  ]

  if (
    !normalized.length
  ) {
    return new Map()
  }

  const rows =
    await CanonicalIngredient.find({
      _id: {
        $in:
          normalized,
      },
    })
      .select({
        canonicalName:
          1,
      })
      .lean()

  return new Map(
    rows.map(
      (
        row,
      ) => [
        stringifyId(
          row._id,
        ),

        row.canonicalName,
      ],
    ),
  )
}

async function getPreferenceForHousehold(
  householdId,
) {
  const preference =
    await RecommendationPreference.findOne({
      householdId,
    }).lean()

  return preference ||
    {
      nextBasketEnabled:
        true,

      pausedUntil:
        null,

      notificationFrequency:
        'important_only',
    }
}

function preferenceIsPaused(
  preference,
  now,
) {
  return Boolean(
    preference?.pausedUntil &&
    new Date(
      preference.pausedUntil,
    ) >
      now,
  )
}

export async function getRecommendationPreferences({
  actorUser,
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  return {
    preferences:
      serializePreference(
        await getPreferenceForHousehold(
          householdId,
        ),
      ),
  }
}

export async function updateRecommendationPreferences({
  input,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const updated =
    await RecommendationPreference.findOneAndUpdate(
      {
        householdId,
      },
      {
        $set: {
          ...(input.nextBasketEnabled !==
          undefined
            ? {
                nextBasketEnabled:
                  input.nextBasketEnabled,
              }
            : {}),

          ...(input.pausedUntil !==
          undefined
            ? {
                pausedUntil:
                  input.pausedUntil,
              }
            : {}),

          ...(input.notificationFrequency !==
          undefined
            ? {
                notificationFrequency:
                  input.notificationFrequency,
              }
            : {}),

          updatedByUserId:
            actorUserId,
        },
      },
      {
        new:
          true,

        upsert:
          true,

        runValidators:
          true,

        setDefaultsOnInsert:
          true,
      },
    ).lean()

  return {
    preferences:
      serializePreference(
        updated,
      ),
  }
}

async function getStoppedIngredientIds(
  householdId,
) {
  const rows =
    await RecommendationFeedback.find({
      householdId,

      action:
        'stop_suggesting',
    })
      .select({
        canonicalIngredientId:
          1,
      })
      .lean()

  return new Set(
    rows.map(
      (
        row,
      ) =>
        stringifyId(
          row.canonicalIngredientId,
        ),
    ),
  )
}

function buildPlannedMealCandidates({
  planning,
  ingredientNameMap,
  householdId,
}) {
  return planning.shortages.map(
    (
      shortage,
    ) => {
      const ingredientId =
        stringifyId(
          shortage.canonicalIngredientId,
        )

      const evidenceReferences =
        shortage.plannedMealIds.map(
          (
            mealId,
          ) =>
            `plannedMeal:${mealId}`,
        )

      const proposedQuantity = {
        mode:
          'exact',

        value:
          shortage.quantity,

        unit:
          shortage.unit,
      }

      return {
        householdId,

        canonicalIngredientId:
          ingredientId,

        ingredientName:
          ingredientNameMap.get(
            ingredientId,
          ) ||
          shortage.label ||
          'Ingredient',

        classification:
          'required_for_planned_meal',

        proposedQuantity,

        confidenceClass:
          'high',

        reasonCode:
          'PLANNED_MEAL_GENUINE_SHORTAGE',

        reasonParameters: {
          shortageQuantity:
            shortage.quantity,

          unit:
            shortage.unit,

          plannedMealCount:
            shortage
              .plannedMealIds
              .length,
        },

        evidenceReferences,

        predictionKey:
          buildNextBasketPredictionKey({
            householdId,

            canonicalIngredientId:
              ingredientId,

            classification:
              'required_for_planned_meal',

            proposedQuantity,

            evidenceReferences,
          }),
      }
    },
  )
}

function buildRunningLowCandidates({
  pantryItems,
  ingredientNameMap,
  householdId,
  excludedIngredientIds,
}) {
  return pantryItems
    .filter(
      (
        item,
      ) =>
        item.state ===
          'running_low' &&
        item.canonicalIngredientId &&
        !item.trackingPaused &&
        !excludedIngredientIds.has(
          stringifyId(
            item.canonicalIngredientId,
          ),
        ),
    )
    .map(
      (
        item,
      ) => {
        const ingredientId =
          stringifyId(
            item.canonicalIngredientId,
          )

        const proposedQuantity = {
          mode:
            'unknown',

          value:
            null,

          unit:
            null,
        }

        const evidenceReferences = [
          `pantryItem:${item.id}`,
        ]

        return {
          householdId,

          canonicalIngredientId:
            ingredientId,

          ingredientName:
            ingredientNameMap.get(
              ingredientId,
            ) ||
            'Ingredient',

          classification:
            'likely_running_low',

          proposedQuantity,

          confidenceClass:
            'medium',

          reasonCode:
            'PANTRY_RUNNING_LOW_SIGNAL',

          reasonParameters: {
            pantryState:
              'running_low',

            exactQuantityClaimed:
              false,
          },

          evidenceReferences,

          predictionKey:
            buildNextBasketPredictionKey({
              householdId,

              canonicalIngredientId:
                ingredientId,

              classification:
                'likely_running_low',

              proposedQuantity,

              evidenceReferences,
            }),
        }
      },
    )
}

export async function getNextBasket({
  actorUser,
  now =
    new Date(),
}) {
  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const preference =
    await getPreferenceForHousehold(
      householdId,
    )

  if (
    preference.nextBasketEnabled ===
      false ||
    preferenceIsPaused(
      preference,
      now,
    )
  ) {
    return {
      items:
        [],

      preferences:
        serializePreference(
          preference,
        ),

      summary: {
        total:
          0,

        suppressed:
          true,

        reason:
          preference.nextBasketEnabled ===
          false
            ? 'NEXT_BASKET_DISABLED'
            : 'NEXT_BASKET_PAUSED',
      },

      deterministic:
        true,

      automaticPurchase:
        false,
    }
  }

  const [
    planning,
    pantry,
  ] =
    await Promise.all([
      recalculateHouseholdPlanning({
        actorUser,

        now,
      }),

      loadPlanningPantry(
        actorUser,
      ),
    ])

  const ingredientIds = [
    ...planning.shortages.map(
      (
        shortage,
      ) =>
        shortage.canonicalIngredientId,
    ),

    ...pantry.map(
      (
        item,
      ) =>
        item.canonicalIngredientId,
    ),
  ]

  const ingredientNameMap =
    await loadIngredientNameMap(
      ingredientIds,
    )

  const stoppedIngredientIds =
    await getStoppedIngredientIds(
      householdId,
    )

  const mealCandidates =
    buildPlannedMealCandidates({
      planning,

      ingredientNameMap,

      householdId:
        stringifyId(
          householdId,
        ),
    }).filter(
      (
        candidate,
      ) =>
        !stoppedIngredientIds.has(
          candidate.canonicalIngredientId,
        ),
    )

  const mealIngredientIds =
    new Set(
      mealCandidates.map(
        (
          candidate,
        ) =>
          candidate.canonicalIngredientId,
      ),
    )

  const runningLowCandidates =
    buildRunningLowCandidates({
      pantryItems:
        pantry,

      ingredientNameMap,

      householdId:
        stringifyId(
          householdId,
        ),

      excludedIngredientIds:
        new Set([
          ...mealIngredientIds,
          ...stoppedIngredientIds,
        ]),
    })

  const candidates = [
    ...mealCandidates,
    ...runningLowCandidates,
  ]

  const currentKeys =
    candidates.map(
      (
        candidate,
      ) =>
        candidate.predictionKey,
    )

  await NextBasketPrediction.updateMany(
    {
      householdId,

      status:
        'active',

      ...(currentKeys.length
        ? {
            predictionKey: {
              $nin:
                currentKeys,
            },
          }
        : {}),
    },
    {
      $set: {
        status:
          'resolved',

        lastEvaluatedAt:
          now,
      },
    },
  )

  const rows =
    []

  for (
    const candidate
    of candidates
  ) {
    let prediction =
      await NextBasketPrediction.findOne({
        householdId,

        predictionKey:
          candidate.predictionKey,
      })

    if (!prediction) {
      prediction =
        await NextBasketPrediction.create({
          ...candidate,

          householdId,

          generatedAt:
            now,

          lastEvaluatedAt:
            now,

          status:
            'active',
        })
    } else {
      prediction.lastEvaluatedAt =
        now

      if (
        prediction.status ===
          'snoozed' &&
        prediction.snoozedUntil &&
        new Date(
          prediction.snoozedUntil,
        ) <=
          now
      ) {
        prediction.status =
          'active'

        prediction.snoozedUntil =
          null
      }

      await prediction.save()
    }

    if (
      [
        'stopped',
        'rejected',
        'corrected',
        'resolved',
      ].includes(
        prediction.status,
      )
    ) {
      continue
    }

    if (
      prediction.status ===
        'snoozed' &&
      prediction.snoozedUntil &&
      new Date(
        prediction.snoozedUntil,
      ) >
        now
    ) {
      continue
    }

    rows.push(
      serializePrediction(
        prediction,
      ),
    )
  }

  return {
    items:
      rows,

    preferences:
      serializePreference(
        preference,
      ),

    planningSummary: {
      plannedMealShortageLines:
        planning
          .shortages
          .length,

      runningLowSignals:
        runningLowCandidates
          .length,
    },

    summary: {
      total:
        rows.length,

      requiredForPlannedMeal:
        rows.filter(
          (
            item,
          ) =>
            item.classification ===
            'required_for_planned_meal',
        ).length,

      likelyRunningLow:
        rows.filter(
          (
            item,
          ) =>
            item.classification ===
            'likely_running_low',
        ).length,

      unsupportedUntilEvidenceExists: [
        'predicted_staple_replenishment',
        'optional_usual_purchase',
        'value_opportunity',
      ],
    },

    deterministic:
      true,

    automaticPurchase:
      false,
  }
}

async function requireOwnedPrediction({
  predictionId,
  householdId,
}) {
  const prediction =
    await NextBasketPrediction.findOne({
      _id:
        predictionId,

      householdId,
    })

  if (!prediction) {
    throw new ApiError(
      404,
      'Next Basket suggestion was not found.',
      [
        {
          code:
            'NEXT_BASKET_PREDICTION_NOT_FOUND',
        },
      ],
    )
  }

  return prediction
}

async function applyPantryCorrectionFromFeedback({
  action,
  quantity,
  prediction,
  actorUser,
}) {
  if (
    ![
      'still_have',
      'bought_elsewhere',
      'correct',
    ].includes(
      action,
    )
  ) {
    return null
  }

  if (
    action ===
      'correct' &&
    (
      !quantity ||
      quantity.mode !==
        'exact'
    )
  ) {
    throw new ApiError(
      400,
      'Correction feedback requires an explicit exact Pantry quantity.',
      [
        {
          code:
            'NEXT_BASKET_CORRECTION_QUANTITY_REQUIRED',
        },
      ],
    )
  }

  const sourceType =
    action ===
    'still_have'
      ? 'manual_have'
      : action ===
          'bought_elsewhere'
        ? 'bought_elsewhere'
        : 'manual_quantity_correction'

  return createCustomerPantryObservation(
    {
      canonicalIngredientId:
        stringifyId(
          prediction.canonicalIngredientId,
        ),

      sourceType,

      ...(quantity
        ? {
            quantity,
          }
        : {}),

      note:
        `M13 Next Basket feedback: ${action}`,
    },
    actorUser,
  )
}

export async function submitNextBasketFeedback({
  predictionId,
  input,
  idempotencyKey,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requirePlanningHousehold(
      actorUser,
    )

  const existingFeedback =
    await RecommendationFeedback.findOne({
      householdId,

      idempotencyKey,
    }).lean()

  if (
    existingFeedback
  ) {
    const existingPrediction =
      await requireOwnedPrediction({
        predictionId:
          existingFeedback
            .nextBasketPredictionId,

        householdId,
      })

    return {
      feedback:
        serializeFeedback(
          existingFeedback,
        ),

      prediction:
        serializePrediction(
          existingPrediction,
        ),

      idempotentReplay:
        true,

      automaticPurchase:
        false,
    }
  }

  const prediction =
    await requireOwnedPrediction({
      predictionId,

      householdId,
    })

  if (
    input.action ===
    'change_brand'
  ) {
    const exists =
      await Brand.exists({
        _id:
          input.brandId,
      })

    if (!exists) {
      throw new ApiError(
        404,
        'Selected Brand was not found.',
        [
          {
            code:
              'NEXT_BASKET_BRAND_NOT_FOUND',
          },
        ],
      )
    }
  }

  await applyPantryCorrectionFromFeedback({
    action:
      input.action,

    quantity:
      input.quantity,

    prediction,

    actorUser,
  })

  switch (
    input.action
  ) {
    case 'accept':
      prediction.status =
        'accepted'

      break

    case 'reject':
      prediction.status =
        'rejected'

      break

    case 'still_have':
    case 'bought_elsewhere':
    case 'correct':
      prediction.status =
        'corrected'

      break

    case 'change_quantity':
      prediction.customerAdjustedQuantity =
        input.quantity

      prediction.status =
        'active'

      break

    case 'change_brand':
      prediction.preferredBrandId =
        input.brandId

      prediction.status =
        'active'

      break

    case 'snooze':
      prediction.status =
        'snoozed'

      prediction.snoozedUntil =
        input.snoozeUntil

      break

    case 'stop_suggesting':
      prediction.status =
        'stopped'

      prediction.snoozedUntil =
        null

      break

    default:
      break
  }

  await prediction.save()

  const feedback =
    await RecommendationFeedback.create({
      householdId,

      nextBasketPredictionId:
        prediction._id,

      canonicalIngredientId:
        prediction.canonicalIngredientId,

      actorUserId,

      action:
        input.action,

      quantity:
        input.quantity ||
        null,

      brandId:
        input.brandId ||
        null,

      snoozeUntil:
        input.snoozeUntil ||
        null,

      note:
        input.note ||
        null,

      idempotencyKey,

      recordedAt:
        new Date(),
    })

  if (
    [
      'still_have',
      'bought_elsewhere',
      'correct',
    ].includes(
      input.action,
    )
  ) {
    await recalculateHouseholdPlanning({
      actorUser,
    })
  }

  return {
    feedback:
      serializeFeedback(
        feedback,
      ),

    prediction:
      serializePrediction(
        prediction,
      ),

    idempotentReplay:
      false,

    automaticPurchase:
      false,
  }
}