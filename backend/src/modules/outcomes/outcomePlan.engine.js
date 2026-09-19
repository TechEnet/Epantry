import {
  convertRecipeQuantity,
} from '../recipes/recipe.scaling.js'

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

export function roundOutcomeQuantity(
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

function uniqueStrings(
  values = [],
) {
  return [
    ...new Set(
      values
        .map(
          (
            value,
          ) =>
            String(
              value ||
                '',
            ).trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

export function normalizeOutcomeRequirement(
  rawRequirement,
) {
  const requiredQuantity =
    Number(
      rawRequirement?.requiredQuantity ??
      rawRequirement?.scaledQuantity ??
      rawRequirement?.quantity ??
      rawRequirement?.requirementQuantity,
    )

  const requiredUnit =
    rawRequirement?.requiredUnit ||
    rawRequirement?.scaledUnit ||
    rawRequirement?.unit ||
    rawRequirement?.requirementUnit ||
    null

  const recipeIngredientId =
    stringifyId(
      rawRequirement?.recipeIngredientId ||
      rawRequirement?.ingredientId ||
      rawRequirement?._id ||
      rawRequirement?.id,
    )

  return {
    recipeIngredientId,

    sourceRecipeIngredientIds:
      uniqueStrings([
        ...(Array.isArray(
          rawRequirement?.sourceRecipeIngredientIds,
        )
          ? rawRequirement.sourceRecipeIngredientIds
          : []),

        recipeIngredientId,
      ]),

    canonicalIngredientId:
      stringifyId(
        rawRequirement?.canonicalIngredientId,
      ),

    requiredQuantity:
      Number.isFinite(
        requiredQuantity,
      )
        ? roundOutcomeQuantity(
            requiredQuantity,
          )
        : null,

    requiredUnit,

    optional:
      rawRequirement?.optional ===
        true ||
      rawRequirement?.isOptional ===
        true,

    label:
      rawRequirement?.label ||
      rawRequirement?.ingredientName ||
      rawRequirement?.name ||
      '',

    substitutionGroupKey:
      String(
        rawRequirement?.substitutionGroupKey ||
          '',
      )
        .trim()
        .toLowerCase(),

    productConstraints:
      uniqueStrings(
        rawRequirement?.productConstraints ||
        [],
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Consolidation Before Pantry Subtraction
|--------------------------------------------------------------------------
|
| Same confirmed Pantry quantity cannot be counted independently against
| duplicate Recipe requirements. Compatible requirements consolidate first.
|
*/

export function consolidateOutcomeRequirements(
  rawRequirements = [],
) {
  const output =
    []

  const byIngredient =
    new Map()

  rawRequirements.forEach(
    (
      rawRequirement,
      index,
    ) => {
      const requirement =
        normalizeOutcomeRequirement(
          rawRequirement,
        )

      if (
        !requirement
          .canonicalIngredientId ||
        !Number.isFinite(
          requirement
            .requiredQuantity,
        ) ||
        requirement
          .requiredQuantity <=
          0 ||
        !requirement
          .requiredUnit
      ) {
        return
      }

      const candidates =
        byIngredient.get(
          requirement
            .canonicalIngredientId,
        ) ||
        []

      for (
        const candidate
        of candidates
      ) {
        const converted =
          safeConvertQuantity({
            quantity:
              requirement
                .requiredQuantity,

            fromUnit:
              requirement
                .requiredUnit,

            toUnit:
              candidate
                .requiredUnit,
          })

        if (
          !Number.isFinite(
            converted,
          )
        ) {
          continue
        }

        candidate.requiredQuantity =
          roundOutcomeQuantity(
            candidate
              .requiredQuantity +
            converted,
          )

        candidate.optional =
          candidate.optional &&
          requirement.optional

        candidate.sourceRecipeIngredientIds =
          uniqueStrings([
            ...candidate
              .sourceRecipeIngredientIds,

            ...requirement
              .sourceRecipeIngredientIds,
          ])

        candidate.productConstraints =
          uniqueStrings([
            ...candidate
              .productConstraints,

            ...requirement
              .productConstraints,
          ])

        if (
          !candidate.label &&
          requirement.label
        ) {
          candidate.label =
            requirement.label
        }

        if (
          !candidate
            .substitutionGroupKey &&
          requirement
            .substitutionGroupKey
        ) {
          candidate.substitutionGroupKey =
            requirement
              .substitutionGroupKey
        }

        return
      }

      const identityKey =
        `${requirement.canonicalIngredientId}:${requirement.requiredUnit}:${index}`

      const next = {
        ...requirement,
        identityKey,
      }

      output.push(
        next,
      )

      byIngredient.set(
        requirement
          .canonicalIngredientId,
        [
          ...candidates,
          next,
        ],
      )
    },
  )

  const identityCounts =
    new Map()

  for (
    const line
    of output
  ) {
    const base =
      `${line.canonicalIngredientId}:${line.requiredUnit}`

    identityCounts.set(
      base,
      (
        identityCounts.get(
          base,
        ) ||
        0
      ) +
        1,
    )
  }

  return output.map(
    (
      line,
    ) => {
      const base =
        `${line.canonicalIngredientId}:${line.requiredUnit}`

      return {
        ...line,

        identityKey:
          identityCounts.get(
            base,
          ) ===
          1
            ? base
            : line.identityKey,
      }
    },
  )
}

function confirmedUsableQuantity({
  requiredQuantity,
  reconciliation,
}) {
  if (
    reconciliation?.status ===
    'available'
  ) {
    return requiredQuantity
  }

  if (
    reconciliation?.status !==
    'partial'
  ) {
    return null
  }

  const available =
    Number(
      reconciliation
        ?.confirmedAvailableQuantity,
    )

  if (
    !Number.isFinite(
      available,
    )
  ) {
    return null
  }

  return roundOutcomeQuantity(
    Math.max(
      0,
      Math.min(
        available,
        requiredQuantity,
      ),
    ),
  )
}

export function deriveOutcomeRequirementLine({
  requirement,
  reconciliation,
  pantryItem =
    null,
  optionalIncluded =
    false,
}) {
  const normalized =
    normalizeOutcomeRequirement(
      requirement,
    )

  const requiredQuantity =
    Number(
      reconciliation
        ?.requiredQuantity ??
      normalized
        .requiredQuantity,
    )

  const requiredUnit =
    reconciliation
      ?.requiredUnit ||
    normalized
      .requiredUnit

  const optional =
    normalized.optional ===
    true

  const pantryState =
    pantryItem?.state ||
    null

  const base = {
    identityKey:
      requirement.identityKey,

    sourceRecipeIngredientIds:
      normalized
        .sourceRecipeIngredientIds,

    canonicalIngredientId:
      normalized
        .canonicalIngredientId,

    label:
      normalized.label,

    requiredQuantity:
      roundOutcomeQuantity(
        requiredQuantity,
      ),

    requiredUnit,

    usablePantryQuantity:
      null,

    pantryState,

    pantryReconciliationState:
      reconciliation?.status ||
      'uncertain',

    pantryReason:
      reconciliation?.reason ||
      'pantry_reconciliation_unavailable',

    pantryConfidence:
      Number.isFinite(
        pantryItem?.confidence,
      )
        ? pantryItem.confidence
        : null,

    genuineShortage:
      null,

    shortageUnit:
      requiredUnit,

    shortageState:
      'uncertain',

    group:
      optional
        ? 'optional_upgrade'
        : 'needs_confirmation',

    optional,

    includedInBasket:
      false,

    purchaseRequired:
      false,

    needsConfirmation:
      true,

    substitutionGroupKey:
      normalized
        .substitutionGroupKey,

    productConstraints:
      normalized
        .productConstraints,
  }

  if (
    reconciliation?.status ===
    'available'
  ) {
    return {
      ...base,

      usablePantryQuantity:
        roundOutcomeQuantity(
          requiredQuantity,
        ),

      genuineShortage:
        0,

      shortageState:
        'none',

      group:
        'already_have',

      needsConfirmation:
        false,
    }
  }

  if (
    reconciliation?.status ===
    'partial'
  ) {
    const usablePantryQuantity =
      confirmedUsableQuantity({
        requiredQuantity,
        reconciliation,
      })

    if (
      Number.isFinite(
        usablePantryQuantity,
      )
    ) {
      const genuineShortage =
        roundOutcomeQuantity(
          Math.max(
            0,
            requiredQuantity -
              usablePantryQuantity,
          ),
        )

      return {
        ...base,

        usablePantryQuantity,

        genuineShortage,

        shortageState:
          genuineShortage >
          0
            ? 'confirmed'
            : 'none',

        group:
          optional
            ? 'optional_upgrade'
            : 'needed',

        includedInBasket:
          genuineShortage >
            0 &&
          (
            !optional ||
            optionalIncluded
          ),

        purchaseRequired:
          genuineShortage >
            0 &&
          (
            !optional ||
            optionalIncluded
          ),

        needsConfirmation:
          false,
      }
    }
  }

  if (
    reconciliation?.status ===
    'missing'
  ) {
    const genuineShortage =
      roundOutcomeQuantity(
        Math.max(
          0,
          requiredQuantity,
        ),
      )

    return {
      ...base,

      usablePantryQuantity:
        0,

      genuineShortage,

      shortageState:
        'confirmed',

      group:
        optional
          ? 'optional_upgrade'
          : 'needed',

      includedInBasket:
        genuineShortage >
          0 &&
        (
          !optional ||
          optionalIncluded
        ),

      purchaseRequired:
        genuineShortage >
          0 &&
        (
          !optional ||
          optionalIncluded
        ),

      needsConfirmation:
        false,
    }
  }

  if (
    pantryState ===
    'running_low'
  ) {
    return {
      ...base,

      group:
        optional
          ? 'optional_upgrade'
          : 'running_low',
    }
  }

  return base
}

export function buildOutcomePlanProjection({
  requirements = [],
  reconciliationLines = [],
  pantryItems = [],
  optionalIncludedIdentityKeys = [],
}) {
  const reconciliationByIdentity =
    new Map()

  reconciliationLines.forEach(
    (
      line,
      index,
    ) => {
      const requirement =
        requirements[index]

      if (
        requirement?.identityKey
      ) {
        reconciliationByIdentity.set(
          requirement.identityKey,
          line,
        )
      }
    },
  )

  const pantryByIngredient =
    new Map(
      pantryItems
        .filter(
          (
            item,
          ) =>
            item
              ?.canonicalIngredientId,
        )
        .map(
          (
            item,
          ) => [
            String(
              item.canonicalIngredientId,
            ),
            item,
          ],
        ),
    )

  const optionalSet =
    new Set(
      optionalIncludedIdentityKeys,
    )

  const lines =
    requirements.map(
      (
        requirement,
      ) =>
        deriveOutcomeRequirementLine({
          requirement,

          reconciliation:
            reconciliationByIdentity.get(
              requirement.identityKey,
            ),

          pantryItem:
            pantryByIngredient.get(
              requirement.canonicalIngredientId,
            ) ||
            null,

          optionalIncluded:
            optionalSet.has(
              requirement.identityKey,
            ),
        }),
    )

  const summary = {
    total:
      lines.length,

    mandatoryLines:
      0,

    alreadyHave:
      0,

    needed:
      0,

    runningLow:
      0,

    needsConfirmation:
      0,

    optionalUpgrade:
      0,

    basketLines:
      0,
  }

  for (
    const line
    of lines
  ) {
    if (
      !line.optional
    ) {
      summary.mandatoryLines +=
        1
    }

    if (
      line.group ===
      'already_have'
    ) {
      summary.alreadyHave +=
        1
    }

    if (
      line.group ===
      'needed'
    ) {
      summary.needed +=
        1
    }

    if (
      line.group ===
      'running_low'
    ) {
      summary.runningLow +=
        1
    }

    if (
      line.group ===
      'needs_confirmation'
    ) {
      summary.needsConfirmation +=
        1
    }

    if (
      line.group ===
      'optional_upgrade'
    ) {
      summary.optionalUpgrade +=
        1
    }

    if (
      line.includedInBasket
    ) {
      summary.basketLines +=
        1
    }
  }

  let readinessState =
    'ready'

  const mandatory =
    lines.filter(
      (
        line,
      ) =>
        !line.optional,
    )

  if (
    mandatory.some(
      (
        line,
      ) =>
        line.needsConfirmation,
    )
  ) {
    readinessState =
      'needs_confirmation'
  } else if (
    mandatory.some(
      (
        line,
      ) =>
        line.purchaseRequired,
    )
  ) {
    readinessState =
      mandatory.every(
        (
          line,
        ) =>
          line.purchaseRequired,
      )
        ? 'missing'
        : 'almost_there'
  }

  const basket =
    lines
      .filter(
        (
          line,
        ) =>
          line.purchaseRequired &&
          line.includedInBasket &&
          line.shortageState ===
            'confirmed' &&
          Number.isFinite(
            line.genuineShortage,
          ) &&
          line.genuineShortage >
            0,
      )
      .map(
        (
          line,
        ) => ({
          identityKey:
            line.identityKey,

          canonicalIngredientId:
            line
              .canonicalIngredientId,

          label:
            line.label,

          quantity:
            line.genuineShortage,

          unit:
            line.shortageUnit,

          optional:
            line.optional,

          substitutionGroupKey:
            line
              .substitutionGroupKey,

          productConstraints:
            line
              .productConstraints,
        }),
      )

  return {
    lines,
    summary,
    readinessState,
    basket,
  }
}