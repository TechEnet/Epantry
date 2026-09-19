import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
  EvidenceSource,
} from '../catalog/catalog.models.js'

import {
  aggregateNormalizedNutrients,
  buildFoodCalculationSnapshot,
  evaluateAllergenPropagation,
  evaluateExplicitDietaryRule,
} from './foodIntelligence.engine.js'

import {
  FoodCalculation,
  IngredientRelation,
  Nutrient,
  RuleProfile,
} from './foodIntelligence.models.js'

function stringId(
  value,
) {
  return String(
    value?._id ||
      value?.id ||
      value ||
      '',
  ).trim()
}

function uniqueIds(
  values,
) {
  return [
    ...new Set(
      values
        .map(
          stringId,
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

export function combineFoodEvidenceStates(
  states,
) {
  const normalized =
    Array.isArray(
      states,
    )
      ? states.filter(
          Boolean,
        )
      : []

  if (
    normalized.includes(
      'unknown_review_required',
    )
  ) {
    return 'unknown_review_required'
  }

  if (
    normalized.includes(
      'inferred',
    )
  ) {
    return 'inferred'
  }

  return 'calculated'
}

export function resolveFoodCalculationStatus(
  evidenceState,
) {
  return [
    'unknown_review_required',
    'inferred',
  ].includes(
    evidenceState,
  )
    ? 'requires_review'
    : 'calculated'
}

async function assertIdsExist({
  model,
  ids,
  label,
}) {
  const normalized =
    uniqueIds(
      ids,
    )

  if (
    normalized.length ===
    0
  ) {
    return
  }

  const rows =
    await model
      .find({
        _id: {
          $in:
            normalized,
        },
      })
      .select(
        '_id',
      )
      .lean()

  const found =
    new Set(
      rows.map(
        (
          row,
        ) =>
          stringId(
            row,
          ),
      ),
    )

  const missing =
    normalized.filter(
      (
        id,
      ) =>
        !found.has(
          id,
        ),
    )

  if (
    missing.length >
    0
  ) {
    throw new ApiError(
      400,
      `Unknown ${label} reference.`,
      [
        {
          code:
            'FOOD_INTELLIGENCE_REFERENCE_NOT_FOUND',

          entity:
            label,

          ids:
            missing,
        },
      ],
    )
  }
}

export async function validateFoodSourceReferences({
  ingredientSources =
    [],
  nutrientSources =
    [],
}) {
  const ingredientIds =
    uniqueIds([
      ...ingredientSources.map(
        (
          item,
        ) =>
          item.canonicalIngredientId,
      ),

      ...nutrientSources.map(
        (
          item,
        ) =>
          item.canonicalIngredientId,
      ),
    ])

  const evidenceSourceIds =
    uniqueIds([
      ...ingredientSources.map(
        (
          item,
        ) =>
          item.evidenceSourceId,
      ),

      ...nutrientSources.map(
        (
          item,
        ) =>
          item.evidenceSourceId,
      ),
    ])

  const nutrientIds =
    uniqueIds(
      nutrientSources.flatMap(
        (
          item,
        ) =>
          (
            item.nutrients ||
            []
          ).map(
            (
              nutrient,
            ) =>
              nutrient.nutrientId,
          ),
      ),
    )

  await assertIdsExist({
    model:
      CanonicalIngredient,

    ids:
      ingredientIds,

    label:
      'canonical Ingredient',
  })

  await assertIdsExist({
    model:
      EvidenceSource,

    ids:
      evidenceSourceIds,

    label:
      'Evidence Source',
  })

  await assertIdsExist({
    model:
      Nutrient,

    ids:
      nutrientIds,

    label:
      'Nutrient',
  })
}

export function buildActiveIngredientRelationFilter({
  canonicalIngredientIds,
  at =
    new Date(),
}) {
  return {
    canonicalIngredientId: {
      $in:
        uniqueIds(
          canonicalIngredientIds,
        ),
    },

    status:
      'active',

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
                at,
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
                at,
            },
          },
        ],
      },
    ],
  }
}

export async function loadActiveIngredientRelationships({
  canonicalIngredientIds,
  at =
    new Date(),
}) {
  const rows =
    await IngredientRelation
      .find(
        buildActiveIngredientRelationFilter({
          canonicalIngredientIds,

          at,
        }),
      )
      .lean()

  return rows.map(
    (
      row,
    ) => ({
      ingredientRelationId:
        stringId(
          row,
        ),

      canonicalIngredientId:
        stringId(
          row.canonicalIngredientId,
        ),

      allergenId:
        stringId(
          row.allergenId,
        ),

      relationType:
        row.relationType,

      evidenceState:
        row.evidenceState,
    }),
  )
}

export async function evaluateDietaryRuleProfiles({
  evaluations =
    [],
  evidenceComplete,
}) {
  if (
    evaluations.length ===
    0
  ) {
    return {
      dietary:
        [],

      ruleProfileVersions:
        [],
    }
  }

  const ids =
    uniqueIds(
      evaluations.map(
        (
          evaluation,
        ) =>
          evaluation.ruleProfileId,
      ),
    )

  const profiles =
    await RuleProfile
      .find({
        _id: {
          $in:
            ids,
        },

        ruleType:
          'dietary',

        status:
          'active',
      })
      .lean()

  const profileMap =
    new Map(
      profiles.map(
        (
          profile,
        ) => [
          stringId(
            profile,
          ),

          profile,
        ],
      ),
    )

  if (
    profileMap.size !==
    ids.length
  ) {
    throw new ApiError(
      409,
      'Every dietary calculation must use an active governed Rule Profile.',
      [
        {
          code:
            'FOOD_DIETARY_ACTIVE_RULE_REQUIRED',
        },
      ],
    )
  }

  const dietary =
    []

  const ruleProfileVersions =
    []

  for (
    const evaluation of
    evaluations
  ) {
    const profile =
      profileMap.get(
        stringId(
          evaluation.ruleProfileId,
        ),
      )

    const requiredFacts =
      Array.isArray(
        profile
          ?.definition
          ?.requiredFacts,
      )
        ? profile
            .definition
            .requiredFacts
        : []

    dietary.push(
      evaluateExplicitDietaryRule({
        ruleKey:
          profile.ruleKey,

        requiredFacts,

        factMap:
          evaluation.factMap,

        evidenceComplete,
      }),
    )

    ruleProfileVersions.push({
      ruleProfileId:
        stringId(
          profile,
        ),

      ruleKey:
        profile.ruleKey,

      version:
        profile.version,
    })
  }

  return {
    dietary,

    ruleProfileVersions,
  }
}

export function buildIngredientSourceVersions(
  ingredientSources,
) {
  return ingredientSources.map(
    (
      source,
    ) => ({
      sourceType:
        'ingredient_evidence',

      sourceId:
        stringId(
          source.canonicalIngredientId,
        ),

      version:
        source.sourceVersion,

      evidenceState:
        source.evidenceState,

      evidenceSourceId:
        stringId(
          source.evidenceSourceId,
        ),
    }),
  )
}

export async function nextFoodCalculationVersion({
  entityType,
  entityId,
}) {
  const latest =
    await FoodCalculation
      .findOne({
        entityType,

        entityId,
      })
      .sort({
        calculationVersion:
          -1,
      })
      .select(
        'calculationVersion',
      )
      .lean()

  return (
    Number(
      latest
        ?.calculationVersion ||
        0,
    ) +
    1
  )
}

export async function persistFoodCalculation({
  entityType,
  entityId,
  engineVersion =
    'm08.1',
  sourceVersions,
  ruleProfileVersions,
  inputs,
  assumptions,
  yieldFactors,
  nutrients,
  allergens,
  dietary,
  evidenceState,
  basis,
  generatedByUserId,
}) {
  let attempt =
    0

  while (
    attempt <
    2
  ) {
    const calculationVersion =
      await nextFoodCalculationVersion({
        entityType,

        entityId,
      })

    const snapshot =
      buildFoodCalculationSnapshot({
        entityType,

        entityId,

        calculationVersion,

        engineVersion,

        sourceVersions,

        ruleProfileVersions,

        inputs,

        assumptions,

        yieldFactors,

        nutrients,

        allergens,

        dietary,

        evidenceState,

        basis,
      })

    try {
      const created =
        await FoodCalculation.create({
          ...snapshot,

          status:
            resolveFoodCalculationStatus(
              evidenceState,
            ),

          generatedByUserId:
            generatedByUserId ||
            null,
        })

      return created.toObject()
    } catch (error) {
      if (
        error?.code ===
          11000 &&
        attempt ===
          0
      ) {
        attempt +=
          1

        continue
      }

      throw error
    }
  }

  throw new ApiError(
    409,
    'Unable to allocate Food Intelligence calculation version.',
    [
      {
        code:
          'FOOD_CALCULATION_VERSION_CONFLICT',
      },
    ],
  )
}

export function calculateAllergenOutput({
  relationships,
  ingredientSources,
}) {
  const evidenceComplete =
    ingredientSources.every(
      (
        source,
      ) =>
        source
          .allergenEvidenceComplete ===
          true &&
        ![
          'unknown_review_required',
          'inferred',
        ].includes(
          source.evidenceState,
        ),
    )

  return evaluateAllergenPropagation({
    relationships,

    evidenceComplete,
  })
}

export function calculateNutrientOutput({
  components,
  ingredientSources,
  basis,
}) {
  const componentIngredientIds =
    new Set(
      components.map(
        (
          component,
        ) =>
          stringId(
            component.canonicalIngredientId,
          ),
      ),
    )

  const evidenceComplete =
    ingredientSources.every(
      (
        source,
      ) =>
        source
          .nutrientEvidenceComplete ===
          true &&
        ![
          'unknown_review_required',
          'inferred',
        ].includes(
          source.evidenceState,
        ) &&
        componentIngredientIds.has(
          stringId(
            source.canonicalIngredientId,
          ),
        ),
    )

  return aggregateNormalizedNutrients({
    components,

    evidenceComplete,

    basis,
  })
}