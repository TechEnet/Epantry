import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  RecipeIngredient,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  aggregateNormalizedNutrients,
  buildFoodCalculationSnapshot,
} from './foodIntelligence.engine.js'

import {
  buildIngredientSourceVersions,
  calculateAllergenOutput,
  combineFoodEvidenceStates,
  evaluateDietaryRuleProfiles,
  loadActiveIngredientRelationships,
  nextFoodCalculationVersion,
  persistFoodCalculation,
  validateFoodSourceReferences,
} from './foodIntelligence.calculation.js'



import {
  normalizeFoodKey,
} from './foodIntelligence.constants.js'

import {
  Allergen,
  FoodCalculation,
  Nutrient,
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

export function assertRecipeVersionFoodIntelligenceEligible(
  recipeVersion,
) {
  if (
    !recipeVersion
  ) {
    throw new ApiError(
      404,
      'Recipe Version not found.',
      [
        {
          code:
            'FOOD_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    ![
      'in_review',
      'published',
    ].includes(
      recipeVersion.status,
    )
  ) {
    throw new ApiError(
      409,
      'Food Intelligence requires a Recipe Version in review or published state.',
      [
        {
          code:
            'FOOD_RECIPE_VERSION_NOT_REVIEWABLE',

          status:
            recipeVersion.status,
        },
      ],
    )
  }
}

export function selectRecipeIngredientsForFoodCalculation({
  recipeIngredients,
  optionalIngredientPolicy,
}) {
  if (
    optionalIngredientPolicy ===
    'include'
  ) {
    return [
      ...recipeIngredients,
    ]
  }

  if (
    optionalIngredientPolicy ===
    'exclude'
  ) {
    return recipeIngredients.filter(
      (
        ingredient,
      ) =>
        ingredient.optional !==
        true,
    )
  }

  throw new TypeError(
    'An explicit optional ingredient policy is required.',
  )
}

export function buildRecipeNutrientComponents({
  recipeIngredients,
  ingredientProfiles,
}) {
  const profileMap =
    new Map(
      ingredientProfiles.map(
        (
          profile,
        ) => [
          stringId(
            profile.canonicalIngredientId,
          ),

          profile,
        ],
      ),
    )

  const components =
    []

  const missingIngredientIds =
    []

  for (
    const ingredient of
    recipeIngredients
  ) {
    const canonicalIngredientId =
      stringId(
        ingredient
          .canonicalIngredientId,
      )

    const profile =
      profileMap.get(
        canonicalIngredientId,
      )

    if (!profile) {
      missingIngredientIds.push(
        canonicalIngredientId,
      )

      continue
    }

    const recipeUnit =
      String(
        ingredient.unit ||
        '',
      ).trim()

    const basisUnit =
      String(
        profile.basisUnit ||
        '',
      ).trim()

    if (
      recipeUnit !==
      basisUnit
    ) {
      throw new ApiError(
        409,
        'Recipe nutrient basis unit does not match the authored Recipe requirement unit.',
        [
          {
            code:
              'FOOD_RECIPE_NUTRIENT_UNIT_CONVERSION_NOT_CONFIGURED',

            canonicalIngredientId,

            recipeUnit,

            basisUnit,
          },
        ],
      )
    }

    const recipeQuantity =
      Number(
        ingredient.quantity,
      )

    const basisQuantity =
      Number(
        profile.basisQuantity,
      )

    if (
      !Number.isFinite(
        recipeQuantity,
      ) ||
      recipeQuantity <
        0 ||
      !Number.isFinite(
        basisQuantity,
      ) ||
      basisQuantity <=
        0
    ) {
      throw new ApiError(
        409,
        'Recipe nutrient calculation contains an invalid quantity basis.',
        [
          {
            code:
              'FOOD_RECIPE_NUTRIENT_INVALID_BASIS',

            canonicalIngredientId,
          },
        ],
      )
    }

    components.push({
      canonicalIngredientId,

      evidenceSourceId:
        profile.evidenceSourceId,

      sourceVersion:
        profile.sourceVersion,

      evidenceState:
        profile.evidenceState,

      quantityFactor:
        recipeQuantity /
        basisQuantity,

      nutrients:
        profile.nutrients,
    })
  }

  return {
    components,

    missingIngredientIds,
  }
}

export function applyExplicitNutritionYieldFactors({
  nutrients,
  yieldFactors,
}) {
  const multiplier =
    (
      yieldFactors ||
      []
    ).reduce(
      (
        current,
        factor,
      ) =>
        current *
        Number(
          factor.multiplier,
        ),

      1,
    )

  return nutrients.map(
    (
      nutrient,
    ) => ({
      ...nutrient,

      amount:
        Number(
          (
            Number(
              nutrient.amount,
            ) *
            multiplier
          ).toFixed(
            8,
          ),
        ),
    }),
  )
}

export async function calculateRecipeFoodIntelligence(
  recipeVersionId,
  input,
  actorUser,
) {
  const recipeVersion =
    await RecipeVersion
      .findById(
        recipeVersionId,
      )
      .lean()

  assertRecipeVersionFoodIntelligenceEligible(
    recipeVersion,
  )

  const allRecipeIngredients =
    await RecipeIngredient
      .find({
        recipeVersionId,
      })
      .sort({
        lineNumber:
          1,
      })
      .lean()

  if (
    allRecipeIngredients.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Recipe Version has no canonical ingredient requirements.',
      [
        {
          code:
            'FOOD_RECIPE_INGREDIENTS_REQUIRED',
        },
      ],
    )
  }

  const selectedIngredients =
    selectRecipeIngredientsForFoodCalculation({
      recipeIngredients:
        allRecipeIngredients,

      optionalIngredientPolicy:
        input.optionalIngredientPolicy,
    })

  await validateFoodSourceReferences({
    ingredientSources:
      input.ingredientProfiles,

    nutrientSources:
      input.ingredientProfiles,
  })

  const {
    components,
    missingIngredientIds,
  } =
    buildRecipeNutrientComponents({
      recipeIngredients:
        selectedIngredients,

      ingredientProfiles:
        input.ingredientProfiles,
    })

  const profileMap =
    new Map(
      input
        .ingredientProfiles
        .map(
          (
            profile,
          ) => [
            stringId(
              profile.canonicalIngredientId,
            ),

            profile,
          ],
        ),
    )

  const selectedProfiles =
    selectedIngredients
      .map(
        (
          ingredient,
        ) =>
          profileMap.get(
            stringId(
              ingredient.canonicalIngredientId,
            ),
          ),
      )
      .filter(
        Boolean,
      )

  const canonicalIngredientIds =
    selectedIngredients.map(
      (
        ingredient,
      ) =>
        ingredient.canonicalIngredientId,
    )

  const relationships =
    await loadActiveIngredientRelationships({
      canonicalIngredientIds,
    })

  const allergenOutput =
    calculateAllergenOutput({
      relationships,

      ingredientSources:
        selectedProfiles,
    })

  const nutritionEvidenceComplete =
    missingIngredientIds.length ===
      0 &&
    selectedProfiles.every(
      (
        profile,
      ) =>
        profile
          .nutrientEvidenceComplete ===
          true &&
        ![
          'inferred',
          'unknown_review_required',
        ].includes(
          profile.evidenceState,
        ),
    )

  const nutrientOutput =
    aggregateNormalizedNutrients({
      components,

      evidenceComplete:
        nutritionEvidenceComplete,

      basis:
        input.basis,
    })

  const nutrientsWithYield =
    applyExplicitNutritionYieldFactors({
      nutrients:
        nutrientOutput.nutrients,

      yieldFactors:
        input.yieldFactors,
    })

  const dietaryOutput =
    await evaluateDietaryRuleProfiles({
      evaluations:
        input.dietaryEvaluations,

      evidenceComplete:
        input.dietaryEvidenceComplete,
    })

  const evidenceState =
    combineFoodEvidenceStates([
      input.entityEvidenceState,

      allergenOutput.evidenceState,

      nutrientOutput.evidenceState,

      missingIngredientIds.length >
        0
        ? 'unknown_review_required'
        : null,

      ...dietaryOutput
        .dietary
        .map(
          (
            result,
          ) =>
            result.evidenceState,
        ),
    ])

  const sourceVersions = [
    {
      sourceType:
        'recipe_version',

      sourceId:
        stringId(
          recipeVersion,
        ),

      version:
        String(
          recipeVersion
            .versionNumber ||
            1,
        ),

      evidenceState:
        input.entityEvidenceState,

      evidenceSourceId:
        null,
    },

    ...buildIngredientSourceVersions(
      selectedProfiles,
    ),
  ]

  const calculation =
    await persistFoodCalculation({
      entityType:
        'recipe_version',

      entityId:
        recipeVersionId,

      sourceVersions,

      ruleProfileVersions:
        dietaryOutput
          .ruleProfileVersions,

      inputs: [
        {
          jurisdictionCode:
            input.jurisdictionCode,

          optionalIngredientPolicy:
            input.optionalIngredientPolicy,

          recipeIngredients:
            selectedIngredients.map(
              (
                ingredient,
              ) => ({
                lineNumber:
                  ingredient.lineNumber,

                canonicalIngredientId:
                  stringId(
                    ingredient.canonicalIngredientId,
                  ),

                quantity:
                  ingredient.quantity,

                unit:
                  ingredient.unit,

                optional:
                  ingredient.optional ===
                  true,
              }),
            ),

          ingredientProfiles:
            selectedProfiles,

          dietaryEvaluations:
            input.dietaryEvaluations,
        },
      ],

      assumptions: [
        ...input.assumptions,

        {
          optionalIngredientPolicy:
            input.optionalIngredientPolicy,
        },

        {
          missingIngredientProfileIds:
            missingIngredientIds,
        },
      ],

      yieldFactors:
        input.yieldFactors,

      nutrients:
        nutrientsWithYield,

      allergens:
        allergenOutput.allergens,

      dietary:
        dietaryOutput.dietary,

      evidenceState,

      basis:
        input.basis,

      generatedByUserId:
        stringId(
          actorUser,
        ) ||
        null,
    })

  return {
    recipeVersion: {
      id:
        stringId(
          recipeVersion,
        ),

      dishId:
        stringId(
          recipeVersion.dishId,
        ),

      versionNumber:
        recipeVersion.versionNumber,

      status:
        recipeVersion.status,
    },

    calculation,
  }
}

/*
|--------------------------------------------------------------------------
| Super Admin Recipe Declaration
|--------------------------------------------------------------------------
|
| Recipe authors should not have to construct M08 ObjectId-heavy calculation
| payloads by hand. This path lets the single EPANTRY Super Admin attach a
| governed recipe-level nutrition / allergen / dietary declaration after the
| Recipe formulation has been reviewed.
|
| The declaration is intentionally marked operator_declared. It removes the
| misleading "cannot verify" state once governed data exists, but it does not
| pretend to be laboratory or regulator verification.
|--------------------------------------------------------------------------
*/

const DECLARED_NUTRIENT_DEFINITIONS =
  Object.freeze({
    energy: {
      canonicalName:
        'Energy',

      canonicalUnit:
        'kcal',
    },

    protein: {
      canonicalName:
        'Protein',

      canonicalUnit:
        'g',
    },

    carbohydrate: {
      canonicalName:
        'Carbohydrate',

      canonicalUnit:
        'g',
    },

    total_fat: {
      canonicalName:
        'Total Fat',

      canonicalUnit:
        'g',
    },

    saturated_fat: {
      canonicalName:
        'Saturated Fat',

      canonicalUnit:
        'g',
    },

    fiber: {
      canonicalName:
        'Dietary Fibre',

      canonicalUnit:
        'g',
    },

    total_sugars: {
      canonicalName:
        'Total Sugars',

      canonicalUnit:
        'g',
    },

    sodium: {
      canonicalName:
        'Sodium',

      canonicalUnit:
        'mg',
    },
  })

async function ensureDeclaredNutrient(
  item,
) {
  const definition =
    DECLARED_NUTRIENT_DEFINITIONS[
      item.key
    ]

  if (!definition) {
    throw new ApiError(
      400,
      'Unsupported declared nutrient.',
      [
        {
          code:
            'FOOD_RECIPE_DECLARED_NUTRIENT_INVALID',

          nutrientKey:
            item.key,
        },
      ],
    )
  }

  if (
    item.unit !==
    definition.canonicalUnit
  ) {
    throw new ApiError(
      400,
      'Declared nutrient unit does not match the canonical unit.',
      [
        {
          code:
            'FOOD_RECIPE_DECLARED_NUTRIENT_UNIT_INVALID',

          nutrientKey:
            item.key,

          expectedUnit:
            definition.canonicalUnit,
        },
      ],
    )
  }

  const nutrient =
    await Nutrient
      .findOneAndUpdate(
        {
          key:
            item.key,
        },
        {
          $setOnInsert: {
            key:
              item.key,

            canonicalName:
              definition.canonicalName,

            canonicalUnit:
              definition.canonicalUnit,

            basisRules:
              [],

            status:
              'active',
          },
        },
        {
          upsert:
            true,

          new:
            true,

          setDefaultsOnInsert:
            true,
        },
      )
      .lean()

  if (
    nutrient.canonicalUnit !==
    definition.canonicalUnit
  ) {
    throw new ApiError(
      409,
      'Existing Nutrient uses a different canonical unit.',
      [
        {
          code:
            'FOOD_RECIPE_DECLARED_NUTRIENT_UNIT_CONFLICT',

          nutrientKey:
            item.key,

          existingUnit:
            nutrient.canonicalUnit,
        },
      ],
    )
  }

  return nutrient
}

async function ensureDeclaredAllergen(
  item,
) {
  const key =
    normalizeFoodKey(
      item.key ||
      item.canonicalName,
    )

  if (!key) {
    throw new ApiError(
      400,
      'Declared allergen key is required.',
      [
        {
          code:
            'FOOD_RECIPE_DECLARED_ALLERGEN_KEY_REQUIRED',
        },
      ],
    )
  }

  return Allergen
    .findOneAndUpdate(
      {
        key,
      },
      {
        $setOnInsert: {
          key,

          canonicalName:
            item.canonicalName,

          jurisdictionMappings:
            [],

          status:
            'active',
        },
      },
      {
        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true,
      },
    )
    .lean()
}

function buildDeclaredDietaryResults(
  classification,
  reasonCode,
) {
  const key =
    String(
      classification ||
      'not_declared',
    )

  if (
    key ===
    'not_declared'
  ) {
    return []
  }

  const classifications = [
    'vegetarian',
    'vegan',
    'eggitarian',
    'non_vegetarian',
  ]

  return classifications.map(
    (
      candidate,
    ) => ({
      ruleKey:
        candidate,

      outcome:
        candidate ===
        key
          ? 'eligible'
          : 'not_eligible',

      evidenceState:
        'operator_declared',

      reasonCodes: [
        reasonCode,
      ],
    }),
  )
}

function declarationInputFromCalculation(
  calculation,
) {
  const input =
    Array.isArray(
      calculation?.inputs,
    )
      ? calculation.inputs.find(
          (
            candidate,
          ) =>
            candidate &&
            typeof candidate ===
              'object' &&
            candidate.declarationType,
        ) ||
        calculation.inputs[0] ||
        {}
      : {}

  return {
    jurisdictionCode:
      String(
        input.jurisdictionCode ||
        'IN',
      ),

    declarationType:
      input.declarationType ||
      null,

    nutrition:
      Array.isArray(
        input.nutrition,
      )
        ? input.nutrition
        : [],

    allergens:
      Array.isArray(
        input.allergens,
      )
        ? input.allergens
        : [],

    dietaryClassification:
      input.dietaryClassification ||
      'not_declared',

    basis:
      calculation?.basis ||
      '',

    reason:
      input.declarationReason ||
      '',
  }
}

async function createRecipeFoodIntelligenceDeclaration({
  recipeVersionId,
  input,
  actorUser,
  approvalMode,
  declarationType,
  engineVersion,
  dietaryReasonCode,
  declarationBoundary,
}) {
  const actorUserId =
    stringId(
      actorUser,
    )

  if (!actorUserId) {
    throw new ApiError(
      401,
      'Authenticated Recipe declaration actor is required.',
      [
        {
          code:
            'FOOD_RECIPE_DECLARATION_ACTOR_REQUIRED',
        },
      ],
    )
  }

  const recipeVersion =
    await RecipeVersion
      .findById(
        recipeVersionId,
      )
      .lean()

  assertRecipeVersionFoodIntelligenceEligible(
    recipeVersion,
  )

  const nutrientRows =
    []

  for (
    const item
    of input.nutrition
  ) {
    const nutrient =
      await ensureDeclaredNutrient(
        item,
      )

    nutrientRows.push({
      nutrientId:
        nutrient._id,

      amount:
        Number(
          item.amount,
        ),

      unit:
        item.unit,

      basis:
        'per_serving',

      evidenceState:
        'operator_declared',
    })
  }

  const allergenRows =
    []

  for (
    const item
    of input.allergens
  ) {
    const allergen =
      await ensureDeclaredAllergen(
        item,
      )

    allergenRows.push({
      allergenId:
        allergen._id,

      outcome:
        item.relationship,

      evidenceState:
        'operator_declared',

      ingredientRelationIds:
        [],
    })
  }

  const dietaryRows =
    buildDeclaredDietaryResults(
      input.dietaryClassification,
      dietaryReasonCode,
    )

  const sourceVersions = [
    {
      sourceType:
        'recipe_version',

      sourceId:
        stringId(
          recipeVersion,
        ),

      version:
        String(
          recipeVersion.versionNumber ||
          1,
        ),

      evidenceState:
        'operator_declared',

      evidenceSourceId:
        null,
    },
  ]

  const previousApproved =
    approvalMode ===
      'approved'
      ? await FoodCalculation
          .findOne({
            entityType:
              'recipe_version',

            entityId:
              recipeVersion._id,

            status:
              'approved',
          })
          .sort({
            calculationVersion:
              -1,
          })
          .select(
            '_id calculationVersion',
          )
          .lean()
      : null

  let attempt =
    0

  while (
    attempt <
    2
  ) {
    const calculationVersion =
      await nextFoodCalculationVersion({
        entityType:
          'recipe_version',

        entityId:
          recipeVersion._id,
      })

    const snapshot =
      buildFoodCalculationSnapshot({
        entityType:
          'recipe_version',

        entityId:
          recipeVersion._id,

        calculationVersion,

        engineVersion,

        sourceVersions,

        ruleProfileVersions:
          [],

        inputs: [
          {
            jurisdictionCode:
              input.jurisdictionCode,

            declarationType,

            declarationReason:
              input.reason,

            nutrition:
              input.nutrition,

            allergens:
              input.allergens,

            dietaryClassification:
              input.dietaryClassification,
          },
        ],

        assumptions: [
          {
            declarationBoundary,
          },
        ],

        yieldFactors:
          [],

        nutrients:
          nutrientRows,

        allergens:
          allergenRows,

        dietary:
          dietaryRows,

        evidenceState:
          'operator_declared',

        basis:
          input.basis,
      })

    try {
      const isApproved =
        approvalMode ===
        'approved'

      const calculation =
        await FoodCalculation.create({
          ...snapshot,

          status:
            isApproved
              ? 'approved'
              : 'requires_review',

          generatedByUserId:
            actorUserId,

          approvedByUserId:
            isApproved
              ? actorUserId
              : null,

          approvedAt:
            isApproved
              ? new Date()
              : null,

          supersedesCalculationId:
            isApproved
              ? previousApproved?._id ||
                null
              : null,
        })

      return {
        recipeVersion: {
          id:
            stringId(
              recipeVersion,
            ),

          dishId:
            stringId(
              recipeVersion.dishId,
            ),

          versionNumber:
            recipeVersion.versionNumber,

          status:
            recipeVersion.status,
        },

        calculation:
          calculation.toObject(),
      }
    } catch (
      error
    ) {
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
    'Unable to allocate Recipe Food Intelligence declaration version.',
    [
      {
        code:
          'FOOD_RECIPE_DECLARATION_VERSION_CONFLICT',
      },
    ],
  )
}

export async function submitRecipeFoodIntelligenceDeclaration(
  recipeVersionId,
  input,
  actorUser,
) {
  return createRecipeFoodIntelligenceDeclaration({
    recipeVersionId,

    input,

    actorUser,

    approvalMode:
      'requires_review',

    declarationType:
      'host_recipe_declaration',

    engineVersion:
      'm08.2-host-recipe-declaration',

    dietaryReasonCode:
      'HOST_RECIPE_DIETARY_DECLARATION',

    declarationBoundary:
      'Recipe-level values were declared by the Host from the submitted formulation. They remain non-authoritative until Super Admin approval and do not generate free-from claims.',
  })
}

export async function declareRecipeFoodIntelligence(
  recipeVersionId,
  input,
  actorUser,
) {
  return createRecipeFoodIntelligenceDeclaration({
    recipeVersionId,

    input,

    actorUser,

    approvalMode:
      'approved',

    declarationType:
      'super_admin_recipe_declaration',

    engineVersion:
      'm08.2-super-admin-recipe-declaration',

    dietaryReasonCode:
      'SUPER_ADMIN_RECIPE_DIETARY_DECLARATION',

    declarationBoundary:
      'Recipe-level values are Super Admin declared from the reviewed formulation. They are not laboratory verification and do not generate free-from claims.',
  })
}

export async function getLatestRecipeFoodIntelligenceDeclaration(
  recipeVersionId,
) {
  const recipeVersion =
    await RecipeVersion
      .findById(
        recipeVersionId,
      )
      .select(
        '_id dishId versionNumber status submittedAt',
      )
      .lean()

  if (!recipeVersion) {
    throw new ApiError(
      404,
      'Recipe Version not found.',
      [
        {
          code:
            'FOOD_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const [
    latest,
    latestApproved,
  ] =
    await Promise.all([
      FoodCalculation
        .findOne({
          entityType:
            'recipe_version',

          entityId:
            recipeVersion._id,
        })
        .sort({
          calculationVersion:
            -1,
        })
        .lean(),

      FoodCalculation
        .findOne({
          entityType:
            'recipe_version',

          entityId:
            recipeVersion._id,

          status:
            'approved',
        })
        .sort({
          calculationVersion:
            -1,
        })
        .lean(),
    ])

  const submittedAtTime =
    recipeVersion.submittedAt
      ? new Date(
          recipeVersion.submittedAt,
        ).getTime()
      : null

  const serialize =
    (
      calculation,
    ) => {
      if (!calculation) {
        return null
      }

      const generatedAtTime =
        calculation.generatedAt
          ? new Date(
              calculation.generatedAt,
            ).getTime()
          : null

      return {
        id:
          stringId(
            calculation,
          ),

        status:
          calculation.status,

        calculationVersion:
          calculation.calculationVersion,

        evidenceState:
          calculation.evidenceState,

        generatedAt:
          calculation.generatedAt ||
          calculation.createdAt ||
          null,

        approvedAt:
          calculation.approvedAt ||
          null,

        generatedByUserId:
          stringId(
            calculation.generatedByUserId,
          ) ||
          null,

        approvedByUserId:
          stringId(
            calculation.approvedByUserId,
          ) ||
          null,

        isStale:
          Number.isFinite(
            submittedAtTime,
          ) &&
          Number.isFinite(
            generatedAtTime,
          )
            ? generatedAtTime <
              submittedAtTime
            : false,

        declaration:
          declarationInputFromCalculation(
            calculation,
          ),
      }
    }

  return {
    recipeVersion: {
      id:
        stringId(
          recipeVersion,
        ),

      dishId:
        stringId(
          recipeVersion.dishId,
        ),

      versionNumber:
        recipeVersion.versionNumber,

      status:
        recipeVersion.status,

      submittedAt:
        recipeVersion.submittedAt ||
        null,
    },

    latest:
      serialize(
        latest,
      ),

    latestApproved:
      serialize(
        latestApproved,
      ),
  }
}
