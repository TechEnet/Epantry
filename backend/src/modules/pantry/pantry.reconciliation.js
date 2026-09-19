import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

/*
|--------------------------------------------------------------------------
| Reconciliation States
|--------------------------------------------------------------------------
*/

export const PANTRY_RECONCILIATION_STATES =
  Object.freeze([
    'available',
    'partial',
    'uncertain',
    'missing',
    'untracked',
  ])

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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
      value,
    )
  ) {
    return null
  }

  return Number(
    value.toFixed(
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

/*
|--------------------------------------------------------------------------
| Unit Conversion
|--------------------------------------------------------------------------
|
| M07 remains authoritative for Recipe requirement-unit conversion.
|
| Incompatible dimensions fail closed to "uncertain".
|
*/

export function convertPantryQuantityToRequirementUnit({
  quantity,
  fromUnit,
  toUnit,
}) {
  if (
    !Number.isFinite(
      quantity,
    )
  ) {
    return null
  }

  if (
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
    const result =
      convertRecipeQuantity({
        quantity,

        fromUnit,

        toUnit,
      })

    return normalizeConvertedQuantity(
      result,
    )
  } catch {
    return null
  }
}

/*
|--------------------------------------------------------------------------
| Requirement Normalization
|--------------------------------------------------------------------------
*/

export function normalizeRecipePantryRequirement(
  requirement,
) {
  const quantity =
    Number(
      requirement?.quantity ??
      requirement?.scaledQuantity ??
      requirement?.requirementQuantity,
    )

  const unit =
    requirement?.unit ||
    requirement?.scaledUnit ||
    requirement?.requirementUnit ||
    null

  return {
    recipeIngredientId:
      stringifyId(
        requirement?.recipeIngredientId ||
        requirement?._id ||
        requirement?.id,
      ),

    canonicalIngredientId:
      stringifyId(
        requirement?.canonicalIngredientId ||
        requirement?.ingredientId,
      ),

    quantity:
      Number.isFinite(
        quantity,
      )
        ? quantity
        : null,

    unit,

    optional:
      requirement?.optional ===
        true ||
      requirement?.isOptional ===
        true,

    label:
      requirement?.label ||
      requirement?.ingredientName ||
      requirement?.name ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Pantry Quantity
|--------------------------------------------------------------------------
*/

function readPantryQuantity(
  pantryItem,
) {
  return (
    pantryItem?.quantity ??
    pantryItem?.quantityEstimate ??
    null
  )
}

function readQuantityMode(
  quantity,
) {
  return (
    quantity?.mode ||
    'unknown'
  )
}

/*
|--------------------------------------------------------------------------
| Exact Reconciliation
|--------------------------------------------------------------------------
*/

function reconcileExactQuantity({
  requirement,
  pantryQuantity,
}) {
  const available =
    convertPantryQuantityToRequirementUnit({
      quantity:
        Number(
          pantryQuantity.exact ??
          pantryQuantity.value,
        ),

      fromUnit:
        pantryQuantity.unit,

      toUnit:
        requirement.unit,
    })

  if (
    !Number.isFinite(
      available,
    )
  ) {
    return {
      status:
        'uncertain',

      confirmedAvailableQuantity:
        null,

      reason:
        'incompatible_or_unknown_unit',
    }
  }

  if (
    available <=
    0
  ) {
    return {
      status:
        'missing',

      confirmedAvailableQuantity:
        0,

      reason:
        'confirmed_zero',
    }
  }

  if (
    available >=
    requirement.quantity
  ) {
    return {
      status:
        'available',

      confirmedAvailableQuantity:
        roundQuantity(
          available,
        ),

      reason:
        'confirmed_quantity_satisfies_requirement',
    }
  }

  return {
    status:
      'partial',

    confirmedAvailableQuantity:
      roundQuantity(
        available,
      ),

    reason:
      'confirmed_quantity_below_requirement',
  }
}

/*
|--------------------------------------------------------------------------
| Range Reconciliation
|--------------------------------------------------------------------------
*/

function reconcileRangeQuantity({
  requirement,
  pantryQuantity,
}) {
  const minimum =
    convertPantryQuantityToRequirementUnit({
      quantity:
        Number(
          pantryQuantity.min,
        ),

      fromUnit:
        pantryQuantity.unit,

      toUnit:
        requirement.unit,
    })

  const maximum =
    convertPantryQuantityToRequirementUnit({
      quantity:
        Number(
          pantryQuantity.max,
        ),

      fromUnit:
        pantryQuantity.unit,

      toUnit:
        requirement.unit,
    })

  if (
    !Number.isFinite(
      minimum,
    ) ||
    !Number.isFinite(
      maximum,
    )
  ) {
    return {
      status:
        'uncertain',

      confirmedAvailableQuantity:
        null,

      reason:
        'incompatible_or_unknown_range_unit',
    }
  }

  if (
    maximum <=
    0
  ) {
    return {
      status:
        'missing',

      confirmedAvailableQuantity:
        0,

      reason:
        'range_confirms_zero',
    }
  }

  if (
    minimum >=
    requirement.quantity
  ) {
    return {
      status:
        'available',

      confirmedAvailableQuantity:
        roundQuantity(
          minimum,
        ),

      reason:
        'range_minimum_satisfies_requirement',
    }
  }

  if (
    maximum <
    requirement.quantity
  ) {
    return {
      status:
        'partial',

      confirmedAvailableQuantity:
        null,

      reason:
        'range_maximum_below_requirement',
    }
  }

  return {
    status:
      'uncertain',

    confirmedAvailableQuantity:
      null,

    reason:
      'range_crosses_requirement_threshold',
  }
}

/*
|--------------------------------------------------------------------------
| One Requirement
|--------------------------------------------------------------------------
*/

export function reconcileRecipeRequirementWithPantry({
  requirement:
    rawRequirement,

  pantryItem,
}) {
  const requirement =
    normalizeRecipePantryRequirement(
      rawRequirement,
    )

  const base = {
    recipeIngredientId:
      requirement.recipeIngredientId,

    canonicalIngredientId:
      requirement.canonicalIngredientId,

    requiredQuantity:
      requirement.quantity,

    requiredUnit:
      requirement.unit,

    optional:
      requirement.optional,

    label:
      requirement.label,

    pantryItemId:
      stringifyId(
        pantryItem?._id ||
        pantryItem?.id,
      ),
  }

  if (
    !pantryItem
  ) {
    return {
      ...base,

      status:
        'missing',

      confirmedAvailableQuantity:
        0,

      reason:
        'no_matching_pantry_observation',
    }
  }

  if (
    !Number.isFinite(
      requirement.quantity,
    ) ||
    requirement.quantity <=
      0 ||
    !requirement.unit
  ) {
    return {
      ...base,

      status:
        'uncertain',

      confirmedAvailableQuantity:
        null,

      reason:
        'invalid_recipe_requirement',
    }
  }

  const pantryState =
    pantryItem.state

  if (
    pantryState ===
    'do_not_track'
  ) {
    return {
      ...base,

      status:
        'untracked',

      confirmedAvailableQuantity:
        null,

      reason:
        'customer_disabled_tracking',
    }
  }

  if (
    pantryState ===
    'out'
  ) {
    return {
      ...base,

      status:
        'missing',

      confirmedAvailableQuantity:
        0,

      reason:
        'pantry_confirms_out',
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Inference Must Never Become Exact Availability
  |--------------------------------------------------------------------------
  */

  if (
    pantryState ===
      'inferred_available' ||
    pantryState ===
      'uncertain' ||
    pantryState ===
      'running_low'
  ) {
    return {
      ...base,

      status:
        'uncertain',

      confirmedAvailableQuantity:
        null,

      reason:
        'pantry_state_not_exactly_confirmed',
    }
  }

  const pantryQuantity =
    readPantryQuantity(
      pantryItem,
    )

  const quantityMode =
    readQuantityMode(
      pantryQuantity,
    )

  /*
  |--------------------------------------------------------------------------
  | Confirmed / Replenished But Quantity Unknown
  |--------------------------------------------------------------------------
  */

  if (
    quantityMode ===
    'unknown'
  ) {
    return {
      ...base,

      status:
        'uncertain',

      confirmedAvailableQuantity:
        null,

      reason:
        'availability_confirmed_but_quantity_unknown',
    }
  }

  if (
    quantityMode ===
    'exact'
  ) {
    return {
      ...base,

      ...reconcileExactQuantity({
        requirement,

        pantryQuantity,
      }),
    }
  }

  if (
    quantityMode ===
    'range'
  ) {
    return {
      ...base,

      ...reconcileRangeQuantity({
        requirement,

        pantryQuantity,
      }),
    }
  }

  return {
    ...base,

    status:
      'uncertain',

    confirmedAvailableQuantity:
      null,

    reason:
      'unsupported_pantry_quantity_mode',
  }
}

/*
|--------------------------------------------------------------------------
| Whole Recipe Reconciliation
|--------------------------------------------------------------------------
*/

export function reconcileRecipeRequirementsWithPantry({
  requirements =
    [],

  pantryItems =
    [],
}) {
  const pantryByIngredient =
    new Map()

  for (
    const pantryItem
    of pantryItems
  ) {
    const ingredientId =
      stringifyId(
        pantryItem
          ?.canonicalIngredientId,
      )

    if (
      ingredientId &&
      !pantryByIngredient.has(
        ingredientId,
      )
    ) {
      pantryByIngredient.set(
        ingredientId,
        pantryItem,
      )
    }
  }

  const lines =
    requirements.map(
      (
        rawRequirement,
      ) => {
        const requirement =
          normalizeRecipePantryRequirement(
            rawRequirement,
          )

        const pantryItem =
          requirement
            .canonicalIngredientId
            ? pantryByIngredient.get(
                requirement
                  .canonicalIngredientId,
              )
            : null

        return reconcileRecipeRequirementWithPantry({
          requirement,

          pantryItem,
        })
      },
    )

  const summary = {
    total:
      lines.length,

    available:
      0,

    partial:
      0,

    uncertain:
      0,

    missing:
      0,

    untracked:
      0,
  }

  for (
    const line
    of lines
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        summary,
        line.status,
      )
    ) {
      summary[
        line.status
      ] +=
        1
    }
  }

  return {
    lines,

    summary,
  }
}