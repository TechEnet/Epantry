import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  getRecipeUnitDimension,
  normalizeRecipeUnit,
} from './recipe.constants.js'

const RECIPE_QUANTITY_PRECISION =
  6

/*
|--------------------------------------------------------------------------
| Deterministic Unit Conversion
|--------------------------------------------------------------------------
|
| Base units:
|
| mass   -> gram
| volume -> millilitre
|
| Count-like units are deliberately NOT converted into one another.
| One piece is not automatically one slice, clove or bunch.
|--------------------------------------------------------------------------
*/

export const RECIPE_UNIT_CONVERSION_FACTORS =
  Object.freeze({
    mass:
      Object.freeze({
        mg:
          0.001,

        g:
          1,

        kg:
          1000,
      }),

    volume:
      Object.freeze({
        ml:
          1,

        l:
          1000,

        tsp:
          5,

        tbsp:
          15,

        cup:
          240,
      }),
  })

function roundRecipeQuantity(
  value,
) {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    throw new ApiError(
      400,
      'Recipe quantity must be finite.',
      [
        {
          code:
            'RECIPE_QUANTITY_INVALID',
        },
      ],
    )
  }

  return Number(
    value.toFixed(
      RECIPE_QUANTITY_PRECISION,
    ),
  )
}

function requirePositiveFiniteNumber(
  value,
  field,
) {
  const numeric =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      numeric,
    ) ||
    numeric <=
      0
  ) {
    throw new ApiError(
      400,
      `${field} must be greater than zero.`,
      [
        {
          code:
            'RECIPE_SCALING_VALUE_INVALID',

          field,
        },
      ],
    )
  }

  return numeric
}

/*
|--------------------------------------------------------------------------
| Unit Conversion
|--------------------------------------------------------------------------
*/

export function convertRecipeQuantity({
  quantity,
  fromUnit,
  toUnit,
}) {
  const numericQuantity =
    requirePositiveFiniteNumber(
      quantity,
      'quantity',
    )

  const normalizedFromUnit =
    normalizeRecipeUnit(
      fromUnit,
    )

  const normalizedToUnit =
    normalizeRecipeUnit(
      toUnit,
    )

  if (
    !normalizedFromUnit ||
    !normalizedToUnit
  ) {
    throw new ApiError(
      400,
      'Known Recipe units are required for conversion.',
      [
        {
          code:
            'RECIPE_UNIT_INVALID',
        },
      ],
    )
  }

  if (
    normalizedFromUnit ===
    normalizedToUnit
  ) {
    return roundRecipeQuantity(
      numericQuantity,
    )
  }

  const fromDimension =
    getRecipeUnitDimension(
      normalizedFromUnit,
    )

  const toDimension =
    getRecipeUnitDimension(
      normalizedToUnit,
    )

  if (
    fromDimension !==
    toDimension
  ) {
    throw new ApiError(
      400,
      'Recipe units from different dimensions cannot be converted.',
      [
        {
          code:
            'RECIPE_UNIT_DIMENSION_MISMATCH',

          fromUnit:
            normalizedFromUnit,

          toUnit:
            normalizedToUnit,
        },
      ],
    )
  }

  const dimensionFactors =
    RECIPE_UNIT_CONVERSION_FACTORS[
      fromDimension
    ]

  /*
  |--------------------------------------------------------------------------
  | Count / Culinary Units
  |--------------------------------------------------------------------------
  |
  | piece, slice, clove, bunch and pinch are not interchangeable.
  |--------------------------------------------------------------------------
  */

  if (
    !dimensionFactors
  ) {
    throw new ApiError(
      400,
      'This Recipe unit does not support automatic conversion.',
      [
        {
          code:
            'RECIPE_UNIT_CONVERSION_UNSUPPORTED',

          fromUnit:
            normalizedFromUnit,

          toUnit:
            normalizedToUnit,
        },
      ],
    )
  }

  const fromFactor =
    dimensionFactors[
      normalizedFromUnit
    ]

  const toFactor =
    dimensionFactors[
      normalizedToUnit
    ]

  if (
    !fromFactor ||
    !toFactor
  ) {
    throw new ApiError(
      400,
      'Recipe unit conversion is not supported.',
      [
        {
          code:
            'RECIPE_UNIT_CONVERSION_UNSUPPORTED',

          fromUnit:
            normalizedFromUnit,

          toUnit:
            normalizedToUnit,
        },
      ],
    )
  }

  const baseQuantity =
    numericQuantity *
    fromFactor

  return roundRecipeQuantity(
    baseQuantity /
      toFactor,
  )
}

/*
|--------------------------------------------------------------------------
| Display Normalization
|--------------------------------------------------------------------------
|
| This changes presentation units only.
|
| It does NOT convert Recipe requirement into retail Pack quantity.
|--------------------------------------------------------------------------
*/

export function normalizeRecipeQuantityForDisplay({
  quantity,
  unit,
}) {
  const numericQuantity =
    requirePositiveFiniteNumber(
      quantity,
      'quantity',
    )

  const normalizedUnit =
    normalizeRecipeUnit(
      unit,
    )

  if (
    !normalizedUnit
  ) {
    throw new ApiError(
      400,
      'Known Recipe unit is required.',
      [
        {
          code:
            'RECIPE_UNIT_INVALID',
        },
      ],
    )
  }

  const dimension =
    getRecipeUnitDimension(
      normalizedUnit,
    )

  if (
    dimension ===
    'mass'
  ) {
    const grams =
      convertRecipeQuantity({
        quantity:
          numericQuantity,

        fromUnit:
          normalizedUnit,

        toUnit:
          'g',
      })

    if (
      grams >=
      1000
    ) {
      return {
        quantity:
          convertRecipeQuantity({
            quantity:
              grams,

            fromUnit:
              'g',

            toUnit:
              'kg',
          }),

        unit:
          'kg',
      }
    }

    if (
      grams <
        1 &&
      grams >
        0
    ) {
      return {
        quantity:
          convertRecipeQuantity({
            quantity:
              grams,

            fromUnit:
              'g',

            toUnit:
              'mg',
          }),

        unit:
          'mg',
      }
    }

    return {
      quantity:
        grams,

      unit:
        'g',
    }
  }

  if (
    dimension ===
    'volume'
  ) {
    const millilitres =
      convertRecipeQuantity({
        quantity:
          numericQuantity,

        fromUnit:
          normalizedUnit,

        toUnit:
          'ml',
      })

    if (
      millilitres >=
      1000
    ) {
      return {
        quantity:
          convertRecipeQuantity({
            quantity:
              millilitres,

            fromUnit:
              'ml',

            toUnit:
              'l',
          }),

        unit:
          'l',
      }
    }

    return {
      quantity:
        millilitres,

      unit:
        'ml',
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Count / Culinary
  |--------------------------------------------------------------------------
  |
  | Preserve the authored unit.
  |--------------------------------------------------------------------------
  */

  return {
    quantity:
      roundRecipeQuantity(
        numericQuantity,
      ),

    unit:
      normalizedUnit,
  }
}

/*
|--------------------------------------------------------------------------
| Scaling Multiplier
|--------------------------------------------------------------------------
*/

export function calculateRecipeScalingMultiplier({
  baseServings,
  targetServings,
  scalingRule = {
    type:
      'linear',
  },
}) {
  const normalizedBaseServings =
    requirePositiveFiniteNumber(
      baseServings,
      'baseServings',
    )

  const normalizedTargetServings =
    requirePositiveFiniteNumber(
      targetServings,
      'targetServings',
    )

  const baseMultiplier =
    normalizedTargetServings /
    normalizedBaseServings

  const rule =
    scalingRule ||
    {}

  const type =
    rule.type ||
    'linear'

  if (
    type ===
    'fixed'
  ) {
    return 1
  }

  if (
    type ===
    'power'
  ) {
    const exponent =
      Number.isFinite(
        Number(
          rule.exponent,
        ),
      )
        ? Number(
            rule.exponent,
          )
        : 1

    if (
      exponent <
        0 ||
      exponent >
        5
    ) {
      throw new ApiError(
        400,
        'Recipe scaling exponent is outside the supported range.',
        [
          {
            code:
              'RECIPE_SCALING_EXPONENT_INVALID',
          },
        ],
      )
    }

    return roundRecipeQuantity(
      Math.pow(
        baseMultiplier,
        exponent,
      ),
    )
  }

  if (
    type ===
    'bounded'
  ) {
    let multiplier =
      baseMultiplier

    const minMultiplier =
      rule.minMultiplier ===
        null ||
      rule.minMultiplier ===
        undefined
        ? null
        : Number(
            rule.minMultiplier,
          )

    const maxMultiplier =
      rule.maxMultiplier ===
        null ||
      rule.maxMultiplier ===
        undefined
        ? null
        : Number(
            rule.maxMultiplier,
          )

    if (
      minMultiplier !==
        null
    ) {
      multiplier =
        Math.max(
          multiplier,
          minMultiplier,
        )
    }

    if (
      maxMultiplier !==
        null
    ) {
      multiplier =
        Math.min(
          multiplier,
          maxMultiplier,
        )
    }

    return roundRecipeQuantity(
      multiplier,
    )
  }

  if (
    type !==
    'linear'
  ) {
    throw new ApiError(
      400,
      'Unknown Recipe scaling rule.',
      [
        {
          code:
            'RECIPE_SCALING_RULE_INVALID',

          scalingRuleType:
            type,
        },
      ],
    )
  }

  return roundRecipeQuantity(
    baseMultiplier,
  )
}

/*
|--------------------------------------------------------------------------
| Scale One Ingredient Requirement
|--------------------------------------------------------------------------
*/

export function scaleRecipeIngredientRequirement({
  ingredient,
  baseServings,
  targetServings,
}) {
  if (
    !ingredient
  ) {
    throw new ApiError(
      400,
      'Recipe ingredient is required.',
      [
        {
          code:
            'RECIPE_INGREDIENT_REQUIRED',
        },
      ],
    )
  }

  const quantity =
    requirePositiveFiniteNumber(
      ingredient.quantity,
      'ingredient.quantity',
    )

  const unit =
    normalizeRecipeUnit(
      ingredient.unit,
    )

  if (!unit) {
    throw new ApiError(
      400,
      'Recipe ingredient uses an unknown unit.',
      [
        {
          code:
            'RECIPE_INGREDIENT_UNIT_INVALID',
        },
      ],
    )
  }

  const multiplier =
    calculateRecipeScalingMultiplier({
      baseServings,

      targetServings,

      scalingRule:
        ingredient.scalingRule,
    })

  const scaledQuantity =
    roundRecipeQuantity(
      quantity *
        multiplier,
    )

  const display =
    normalizeRecipeQuantityForDisplay({
      quantity:
        scaledQuantity,

      unit,
    })

  return {
    ingredientId:
      ingredient.id ||
      String(
        ingredient._id ||
          '',
      ) ||
      null,

    canonicalIngredientId:
      ingredient.canonicalIngredientId
        ? String(
            ingredient.canonicalIngredientId,
          )
        : null,

    lineNumber:
      ingredient.lineNumber,

    sourceQuantity:
      quantity,

    sourceUnit:
      unit,

    scaledQuantity,

    scaledUnit:
      unit,

    displayQuantity:
      display.quantity,

    displayUnit:
      display.unit,

    multiplier,

    scalingRuleType:
      ingredient.scalingRule
        ?.type ||
      'linear',

    optional:
      ingredient.optional ===
      true,

    role:
      ingredient.role ||
      'main',

    preparationState:
      ingredient.preparationState ||
      '',

    notes:
      ingredient.notes ||
      '',
  }
}

/*
|--------------------------------------------------------------------------
| Recommended Serving Warnings
|--------------------------------------------------------------------------
*/

export function getRecipeScalingWarnings({
  targetServings,
  minRecommendedServings,
  maxRecommendedServings,
}) {
  const warnings = []

  if (
    minRecommendedServings !==
      null &&
    minRecommendedServings !==
      undefined &&
    targetServings <
      minRecommendedServings
  ) {
    warnings.push({
      code:
        'RECIPE_BELOW_RECOMMENDED_SERVINGS',

      recommendedMinimum:
        minRecommendedServings,
    })
  }

  if (
    maxRecommendedServings !==
      null &&
    maxRecommendedServings !==
      undefined &&
    targetServings >
      maxRecommendedServings
  ) {
    warnings.push({
      code:
        'RECIPE_ABOVE_RECOMMENDED_SERVINGS',

      recommendedMaximum:
        maxRecommendedServings,
    })
  }

  return warnings
}

/*
|--------------------------------------------------------------------------
| Scale Whole Recipe
|--------------------------------------------------------------------------
*/

export function scaleRecipeAggregate({
  recipeVersion,
  ingredients = [],
  substitutions = [],
  targetServings,
}) {
  if (
    !recipeVersion
  ) {
    throw new ApiError(
      400,
      'Recipe Version is required for scaling.',
      [
        {
          code:
            'RECIPE_VERSION_REQUIRED',
        },
      ],
    )
  }

  const normalizedTargetServings =
    requirePositiveFiniteNumber(
      targetServings,
      'targetServings',
    )

  if (
    normalizedTargetServings >
    1000
  ) {
    throw new ApiError(
      400,
      'Recipe scaling supports at most 1000 servings.',
      [
        {
          code:
            'RECIPE_TARGET_SERVINGS_TOO_LARGE',
        },
      ],
    )
  }

  const baseServings =
    requirePositiveFiniteNumber(
      recipeVersion.baseServings,
      'baseServings',
    )

  const scaleFactor =
    roundRecipeQuantity(
      normalizedTargetServings /
        baseServings,
    )

  const scaledIngredients =
    ingredients.map(
      (
        ingredient,
      ) =>
        scaleRecipeIngredientRequirement({
          ingredient,

          baseServings,

          targetServings:
            normalizedTargetServings,
        }),
    )

  const scaledIngredientById =
    new Map(
      scaledIngredients
        .filter(
          (
            ingredient,
          ) =>
            ingredient.ingredientId,
        )
        .map(
          (
            ingredient,
          ) => [
            String(
              ingredient.ingredientId,
            ),

            ingredient,
          ],
        ),
    )

  const scaledSubstitutions =
    substitutions
      .map(
        (
          substitution,
        ) => {
          const sourceIngredientId =
            String(
              substitution.sourceRecipeIngredientId ||
                '',
            )

          const scaledSourceIngredient =
            scaledIngredientById.get(
              sourceIngredientId,
            )

          if (
            !scaledSourceIngredient
          ) {
            return null
          }

          const replacementRatio =
            requirePositiveFiniteNumber(
              substitution.replacementRatio ||
                1,
              'substitution.replacementRatio',
            )

          const replacementUnit =
            normalizeRecipeUnit(
              substitution.replacementUnit ||
                scaledSourceIngredient.scaledUnit,
            )

          if (
            !replacementUnit
          ) {
            throw new ApiError(
              400,
              'Recipe substitution uses an unknown replacement unit.',
              [
                {
                  code:
                    'RECIPE_SUBSTITUTION_UNIT_INVALID',
                },
              ],
            )
          }

          const replacementQuantity =
            roundRecipeQuantity(
              scaledSourceIngredient.scaledQuantity *
                replacementRatio,
            )

          const display =
            normalizeRecipeQuantityForDisplay({
              quantity:
                replacementQuantity,

              unit:
                replacementUnit,
            })

          return {
            id:
              substitution.id ||
              String(
                substitution._id ||
                  '',
              ) ||
              null,

            sourceRecipeIngredientId:
              sourceIngredientId,

            substituteCanonicalIngredientId:
              substitution.substituteCanonicalIngredientId
                ? String(
                    substitution.substituteCanonicalIngredientId,
                  )
                : null,

            replacementRatio,

            replacementQuantity,

            replacementUnit,

            displayQuantity:
              display.quantity,

            displayUnit:
              display.unit,

            priority:
              substitution.priority ||
              1,

            notes:
              substitution.notes ||
              '',
          }
        },
      )
      .filter(
        Boolean,
      )

  return {
    recipeVersionId:
      recipeVersion.id ||
      String(
        recipeVersion._id ||
          '',
      ) ||
      null,

    baseServings,

    targetServings:
      normalizedTargetServings,

    scaleFactor,

    warnings:
      getRecipeScalingWarnings({
        targetServings:
          normalizedTargetServings,

        minRecommendedServings:
          recipeVersion.minRecommendedServings,

        maxRecommendedServings:
          recipeVersion.maxRecommendedServings,
      }),

    ingredients:
      scaledIngredients,

    substitutions:
      scaledSubstitutions,
  }
}