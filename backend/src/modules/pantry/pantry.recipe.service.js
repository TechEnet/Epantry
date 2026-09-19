import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Dish,
  RecipeIngredient,
  RecipeSubstitution,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  convertRecipeQuantity,
  scaleRecipeAggregate,
} from '../recipes/recipe.scaling.js'

import {
  PantryConsumptionEvent,
  PantryItem,
} from './pantry.models.js'

import {
  reconcileRecipeRequirementsWithPantry,
} from './pantry.reconciliation.js'

import {
  createPantryObservationForHousehold,
  requireCurrentPantryHousehold,
  serializePantryItem,
} from './pantry.service.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const OBJECT_ID_PATTERN =
  /^[a-f\d]{24}$/i

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

function actorIdFromUser(
  actorUser,
) {
  const id =
    actorUser?._id ||
    actorUser?.id

  if (!id) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'PANTRY_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return id
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

function safeConvertQuantity({
  quantity,
  fromUnit,
  toUnit,
}) {
  if (
    !Number.isFinite(
      quantity,
    ) ||
    !fromUnit ||
    !toUnit
  ) {
    return null
  }

  if (
    fromUnit ===
    toUnit
  ) {
    return quantity
  }

  try {
    return normalizeConvertedQuantity(
      convertRecipeQuantity({
        quantity,

        fromUnit,

        toUnit,
      }),
    )
  } catch {
    return null
  }
}

/*
|--------------------------------------------------------------------------
| Published Recipe
|--------------------------------------------------------------------------
*/

async function requirePublishedRecipe(
  recipeId,
  now =
    new Date(),
) {
  const dishFilter =
    OBJECT_ID_PATTERN.test(
      recipeId,
    )
      ? {
          _id:
            recipeId,
        }
      : {
          slug:
            recipeId,
        }

  const dish =
    await Dish
      .findOne({
        ...dishFilter,

        status:
          'active',
      })
      .lean()

  if (!dish) {
    throw new ApiError(
      404,
      'Published Recipe was not found.',
      [
        {
          code:
            'PANTRY_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  const recipeVersion =
    await RecipeVersion
      .findOne({
        dishId:
          dish._id,

        status:
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
      .sort({
        version:
          -1,

        publishedAt:
          -1,
      })
      .lean()

  if (!recipeVersion) {
    throw new ApiError(
      404,
      'Published Recipe Version was not found.',
      [
        {
          code:
            'PANTRY_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const [
    ingredients,
    substitutions,
  ] =
    await Promise.all([
      RecipeIngredient
        .find({
          recipeVersionId:
            recipeVersion._id,
        })
        .sort({
          lineNumber:
            1,
        })
        .lean(),

      RecipeSubstitution
        .find({
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

  return {
    dish,

    recipeVersion,

    ingredients,

    substitutions,
  }
}

/*
|--------------------------------------------------------------------------
| Scale Recipe
|--------------------------------------------------------------------------
*/

function getScaledRequirements({
  recipeVersion,
  ingredients,
  substitutions,
  targetServings,
}) {
  const scaled =
    scaleRecipeAggregate({
      recipeVersion,

      ingredients,

      substitutions,

      targetServings,
    })

  const rows =
    scaled?.ingredients ||
    scaled?.scaledIngredients ||
    scaled?.requirements ||
    []

  return {
    scaled,

    requirements:
      rows.map(
        (
          row,
        ) => ({
          recipeIngredientId:
            row.recipeIngredientId ||
            row._id ||
            row.id,

          canonicalIngredientId:
            row.canonicalIngredientId ||
            row.ingredientId,

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
            null,
        }),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Load Pantry
|--------------------------------------------------------------------------
*/

async function loadHouseholdPantryForRequirements({
  householdId,
  requirements,
}) {
  const ingredientIds =
    [
      ...new Set(
        requirements
          .map(
            (
              requirement,
            ) =>
              stringifyId(
                requirement
                  .canonicalIngredientId,
              ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  if (
    ingredientIds.length ===
    0
  ) {
    return []
  }

  const items =
    await PantryItem
      .find({
        householdId,

        canonicalIngredientId: {
          $in:
            ingredientIds,
        },
      })
      .lean()

  return items.map(
    (
      item,
    ) => {
      const serialized =
        serializePantryItem(
          item,
        )

      return {
        ...item,

        state:
          serialized.state,

        quantity:
          serialized.quantity,

        quantityEstimate:
          serialized.quantity,

        confidence:
          serialized.confidence,
      }
    },
  )
}

/*
|--------------------------------------------------------------------------
| Recipe → Pantry Reconciliation
|--------------------------------------------------------------------------
*/

export async function getRecipePantryReconciliation({
  recipeId,
  targetServings,
  actorUser,
  now =
    new Date(),
}) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const recipe =
    await requirePublishedRecipe(
      recipeId,
      now,
    )

  const {
    scaled,
    requirements,
  } =
    getScaledRequirements({
      recipeVersion:
        recipe.recipeVersion,

      ingredients:
        recipe.ingredients,

      substitutions:
        recipe.substitutions,

      targetServings,
    })

  const pantryItems =
    await loadHouseholdPantryForRequirements({
      householdId,

      requirements,
    })

  const reconciliation =
    reconcileRecipeRequirementsWithPantry({
      requirements,

      pantryItems,
    })

  return {
    dish: {
      id:
        stringifyId(
          recipe.dish._id,
        ),

      slug:
        recipe.dish.slug,

      title:
        recipe.dish.title ||
        recipe.recipeVersion.title ||
        null,
    },

    recipeVersion: {
      id:
        stringifyId(
          recipe.recipeVersion._id,
        ),

      version:
        recipe.recipeVersion.version,

      status:
        recipe.recipeVersion.status,
    },

    targetServings,

    scalingWarnings:
      scaled?.warnings ||
      [],

    reconciliation,
  }
}

/*
|--------------------------------------------------------------------------
| Consumption Projection
|--------------------------------------------------------------------------
*/

function buildConsumptionProjection({
  pantryItem,
  requirement,
}) {
  const quantity =
    pantryItem.quantityEstimate ||
    pantryItem.quantity ||
    null

  if (
    pantryItem.state ===
    'do_not_track'
  ) {
    return {
      stateSignal:
        'do_not_track',

      quantity:
        undefined,
    }
  }

  if (
    pantryItem.state ===
    'out'
  ) {
    return {
      stateSignal:
        'out',

      quantity:
        undefined,
    }
  }

  if (
    quantity?.mode ===
    'exact'
  ) {
    const consumedInPantryUnit =
      safeConvertQuantity({
        quantity:
          Number(
            requirement.quantity,
          ),

        fromUnit:
          requirement.unit,

        toUnit:
          quantity.unit,
      })

    if (
      Number.isFinite(
        consumedInPantryUnit,
      )
    ) {
      const current =
        Number(
          quantity.value,
        )

      if (
        Number.isFinite(
          current,
        )
      ) {
        const remaining =
          Math.max(
            0,
            current -
            consumedInPantryUnit,
          )

        return {
          stateSignal:
            remaining <=
            0
              ? 'out'
              : 'confirmed_available',

          quantity: {
            mode:
              'exact',

            value:
              Number(
                remaining.toFixed(
                  6,
                ),
              ),

            unit:
              quantity.unit,
          },
        }
      }
    }
  }

  if (
    quantity?.mode ===
    'range'
  ) {
    const consumedInPantryUnit =
      safeConvertQuantity({
        quantity:
          Number(
            requirement.quantity,
          ),

        fromUnit:
          requirement.unit,

        toUnit:
          quantity.unit,
      })

    if (
      Number.isFinite(
        consumedInPantryUnit,
      )
    ) {
      const minimum =
        Math.max(
          0,
          Number(
            quantity.min,
          ) -
          consumedInPantryUnit,
        )

      const maximum =
        Math.max(
          0,
          Number(
            quantity.max,
          ) -
          consumedInPantryUnit,
        )

      if (
        Number.isFinite(
          minimum,
        ) &&
        Number.isFinite(
          maximum,
        )
      ) {
        if (
          maximum <=
          0
        ) {
          return {
            stateSignal:
              'out',

            quantity: {
              mode:
                'range',

              min:
                0,

              max:
                0,

              unit:
                quantity.unit,
            },
          }
        }

        return {
          stateSignal:
            'uncertain',

          quantity: {
            mode:
              'range',

            min:
              Number(
                minimum.toFixed(
                  6,
                ),
              ),

            max:
              Number(
                maximum.toFixed(
                  6,
                ),
              ),

            unit:
              quantity.unit,
          },
        }
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Unknown or Inferred Quantity
  |--------------------------------------------------------------------------
  |
  | Cooking proves consumption happened, but does not justify inventing a
  | precise remaining balance.
  |
  */

  return {
    stateSignal:
      'uncertain',

    quantity:
      undefined,
  }
}

/*
|--------------------------------------------------------------------------
| Cooked
|--------------------------------------------------------------------------
*/

export async function recordRecipeCooked({
  recipeId,
  targetServings,
  idempotencyKey,
  occurredAt =
    new Date(),

  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const recipe =
    await requirePublishedRecipe(
      recipeId,
      occurredAt,
    )

  const {
    scaled,
    requirements,
  } =
    getScaledRequirements({
      recipeVersion:
        recipe.recipeVersion,

      ingredients:
        recipe.ingredients,

      substitutions:
        recipe.substitutions,

      targetServings,
    })

  const pantryItems =
    await loadHouseholdPantryForRequirements({
      householdId,

      requirements,
    })

  const reconciliation =
    reconcileRecipeRequirementsWithPantry({
      requirements,

      pantryItems,
    })

  const pantryById =
    new Map(
      pantryItems.map(
        (
          item,
        ) => [
          stringifyId(
            item._id,
          ),
          item,
        ],
      ),
    )

  const transaction =
    await mongoose.startSession()

  try {
    const consumptionEvents = []

    await transaction.withTransaction(
      async () => {
        for (
          const line
          of reconciliation.lines
        ) {
          if (
            !line.pantryItemId
          ) {
            continue
          }

          const pantryItem =
            pantryById.get(
              line.pantryItemId,
            )

          if (!pantryItem) {
            continue
          }

          const requirement =
            requirements.find(
              (
                candidate,
              ) =>
                stringifyId(
                  candidate
                    .canonicalIngredientId,
                ) ===
                line.canonicalIngredientId,
            )

          if (
            !requirement ||
            !Number.isFinite(
              Number(
                requirement.quantity,
              ),
            )
          ) {
            continue
          }

          const eventKey =
            [
              'dish.cooked',

              stringifyId(
                recipe
                  .recipeVersion
                  ._id,
              ),

              idempotencyKey,

              stringifyId(
                pantryItem._id,
              ),
            ].join(
              ':',
            )

          const existing =
            await PantryConsumptionEvent
              .findOne({
                householdId,

                eventKey,
              })
              .session(
                transaction,
              )
              .lean()

          if (
            existing
          ) {
            consumptionEvents.push({
              id:
                stringifyId(
                  existing._id,
                ),

              eventKey,

              duplicate:
                true,
            })

            continue
          }

          const created =
            await PantryConsumptionEvent.create(
              [
                {
                  householdId,

                  pantryItemId:
                    pantryItem._id,

                  recipeVersionId:
                    recipe.recipeVersion._id,

                  eventKey,

                  sourceType:
                    'recipe_cooked',

                  quantityConsumed:
                    Number(
                      requirement.quantity,
                    ),

                  unit:
                    requirement.unit,

                  occurredAt,

                  actorUserId,
                },
              ],

              {
                session:
                  transaction,
              },
            )

          const event =
            created[0]

          const projection =
            buildConsumptionProjection({
              pantryItem,

              requirement,
            })

          await createPantryObservationForHousehold({
            householdId,

            canonicalPackId:
              pantryItem
                .canonicalPackId ||
              null,

            canonicalIngredientId:
              pantryItem
                .canonicalIngredientId ||
              null,

            sourceType:
              'recipe_consumption',

            quantity:
              projection.quantity,

            observedAt:
              occurredAt,

            actorUser,

            customerCorrection:
              false,

            stateSignal:
              projection.stateSignal,

            note:
              `Consumed through cooked Recipe Version ${stringifyId(
                recipe
                  .recipeVersion
                  ._id,
              )}.`,

            session:
              transaction,
          })

          consumptionEvents.push({
            id:
              stringifyId(
                event._id,
              ),

            eventKey,

            duplicate:
              false,
          })
        }
      },
    )

    const updatedPantryItems =
      await loadHouseholdPantryForRequirements({
        householdId,

        requirements,
      })

    const updatedReconciliation =
      reconcileRecipeRequirementsWithPantry({
        requirements,

        pantryItems:
          updatedPantryItems,
      })

    return {
      event:
        'dish.cooked',

      idempotencyKey,

      dish: {
        id:
          stringifyId(
            recipe.dish._id,
          ),

        slug:
          recipe.dish.slug,

        title:
          recipe.dish.title ||
          recipe
            .recipeVersion
            .title ||
          null,
      },

      recipeVersion: {
        id:
          stringifyId(
            recipe
              .recipeVersion
              ._id,
          ),

        version:
          recipe.recipeVersion.version,
      },

      targetServings,

      occurredAt,

      scalingWarnings:
        scaled?.warnings ||
        [],

      before:
        reconciliation,

      after:
        updatedReconciliation,

      consumptionEvents,
    }
  } finally {
    await transaction.endSession()
  }
}