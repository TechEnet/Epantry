import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  EvidenceSource,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  CommunityProductDraft,
} from '../universalProduct/universalProduct.models.js'

import {
  buildFoodCalculationSnapshot,
} from './foodIntelligence.engine.js'

import {
  calculateAllergenOutput,
  calculateNutrientOutput,
  combineFoodEvidenceStates,
  buildIngredientSourceVersions,
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

export function resolveProductVersionFoodStatus(
  productVersion,
) {
  return String(
    productVersion
      ?.publicationStatus ||
      productVersion
        ?.status ||
      productVersion
        ?.lifecycleStatus ||
      '',
  )
    .trim()
    .toLowerCase()
}

export function assertProductVersionFoodIntelligenceEligible(
  productVersion,
) {
  if (
    !productVersion
  ) {
    throw new ApiError(
      404,
      'Product Version not found.',
      [
        {
          code:
            'FOOD_PRODUCT_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const status =
    resolveProductVersionFoodStatus(
      productVersion,
    )

  if (
    status !==
    'published'
  ) {
    throw new ApiError(
      409,
      'Food Intelligence may only be calculated for published canonical Product Versions.',
      [
        {
          code:
            'FOOD_PRODUCT_VERSION_NOT_PUBLISHED',

          status,
        },
      ],
    )
  }
}

function resolveProductVersionNumber(
  productVersion,
) {
  return String(
    productVersion
      ?.versionNumber ??
      productVersion
        ?.version ??
      productVersion
        ?.sequence ??
      1,
  )
}

export async function calculateProductFoodIntelligence(
  productVersionId,
  input,
  actorUser,
) {
  const productVersion =
    await ProductVersion
      .findById(
        productVersionId,
      )
      .lean()

  assertProductVersionFoodIntelligenceEligible(
    productVersion,
  )

  await validateFoodSourceReferences({
    ingredientSources:
      input.ingredientSources,

    nutrientSources:
      input.nutrientComponents,
  })

  const canonicalIngredientIds =
    input
      .ingredientSources
      .map(
        (
          source,
        ) =>
          source.canonicalIngredientId,
      )

  const relationships =
    await loadActiveIngredientRelationships({
      canonicalIngredientIds,
    })

  const allergenOutput =
    calculateAllergenOutput({
      relationships,

      ingredientSources:
        input.ingredientSources,
    })

  const nutrientOutput =
    calculateNutrientOutput({
      components:
        input.nutrientComponents,

      ingredientSources:
        input.ingredientSources,

      basis:
        input.basis,
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
        'product_version',

      sourceId:
        stringId(
          productVersion,
        ),

      version:
        resolveProductVersionNumber(
          productVersion,
        ),

      evidenceState:
        input.entityEvidenceState,

      evidenceSourceId:
        null,
    },

    ...buildIngredientSourceVersions(
      input.ingredientSources,
    ),
  ]

  const calculation =
    await persistFoodCalculation({
      entityType:
        'product_version',

      entityId:
        productVersionId,

      sourceVersions,

      ruleProfileVersions:
        dietaryOutput
          .ruleProfileVersions,

      inputs: [
        {
          jurisdictionCode:
            input.jurisdictionCode,

          ingredientSources:
            input.ingredientSources,

          nutrientComponents:
            input.nutrientComponents,

          dietaryEvaluations:
            input.dietaryEvaluations,
        },
      ],

      assumptions: [
        ...input.assumptions,

        {
          canonicalProductVersionStatus:
            resolveProductVersionFoodStatus(
              productVersion,
            ),
        },
      ],

      yieldFactors:
        [],

      nutrients:
        nutrientOutput.nutrients,

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
    productVersion: {
      id:
        stringId(
          productVersion,
        ),

      status:
        resolveProductVersionFoodStatus(
          productVersion,
        ),

      version:
        resolveProductVersionNumber(
          productVersion,
        ),
    },

    calculation,
  }
}

/*
|--------------------------------------------------------------------------
| Super Admin Product Food Intelligence Declaration
|--------------------------------------------------------------------------
|
| Host S03 captures package/manufacturer declarations and evidence. After
| the canonical ProductVersion is published, Super Admin may create or revise
| the public Food Intelligence snapshot here without asking an operator to
| construct ObjectId-heavy M08 calculation payloads manually.
|
| The resulting calculation is explicitly operator_declared. It is an
| approved reviewed source declaration, not laboratory verification and not
| a free-from claim. Every edit creates a new immutable FoodCalculation and
| supersedes the prior approved snapshot.
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

async function ensureDeclaredProductNutrient(
  item,
) {
  const definition =
    DECLARED_NUTRIENT_DEFINITIONS[
      item.key
    ]

  if (!definition) {
    throw new ApiError(
      400,
      'Unsupported declared Product nutrient.',
      [
        {
          code:
            'FOOD_PRODUCT_DECLARED_NUTRIENT_INVALID',

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
      'Declared Product nutrient unit does not match the canonical unit.',
      [
        {
          code:
            'FOOD_PRODUCT_DECLARED_NUTRIENT_UNIT_INVALID',

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
            'FOOD_PRODUCT_DECLARED_NUTRIENT_UNIT_CONFLICT',

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

async function ensureDeclaredProductAllergen(
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
      'Declared Product allergen key is required.',
      [
        {
          code:
            'FOOD_PRODUCT_DECLARED_ALLERGEN_KEY_REQUIRED',
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

async function readApprovedNpiAllergenStatement(
  productVersionId,
) {
  const draft =
    await CommunityProductDraft
      .findOne({
        catalogProductVersionId:
          productVersionId,

        status:
          'approved_for_catalog',

        verificationStatus:
          'reviewed',

        readyForCatalog:
          true,
      })
      .sort({
        reviewedAt:
          -1,

        updatedAt:
          -1,
      })
      .select(
        'candidateFields.allergens',
      )
      .lean()

  const candidate =
    draft?.candidateFields
      ?.allergens

  if (
    candidate?.reviewState !==
      'accepted'
  ) {
    return ''
  }

  return String(
    candidate?.value
      ?.statement ||
      '',
  ).trim()
}

async function loadProductDeclarationEvidenceSources(
  productVersionId,
) {
  const rows =
    await EvidenceSource
      .find({
        entityType:
          'product_version',

        entityId:
          productVersionId,
      })
      .sort({
        capturedAt:
          -1,

        createdAt:
          -1,
      })
      .limit(
        12,
      )
      .lean()

  return rows.map(
    (item) => ({
      sourceType:
        'evidence_source',

      sourceId:
        stringId(
          item,
        ),

      version:
        new Date(
          item.capturedAt ||
          item.createdAt ||
          Date.now(),
        ).toISOString(),

      evidenceState:
        item.evidenceState ||
        'operator_declared',

      evidenceSourceId:
        item._id ||
        null,
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
            candidate.declarationType ===
              'super_admin_product_declaration',
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

    nutritionBasis:
      input.nutritionBasis ||
      'per_100g',

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

    allergenStatement:
      String(
        input.allergenStatement ||
        '',
      ).trim(),

    dietary:
      Array.isArray(
        input.dietary,
      )
        ? input.dietary
        : [],

    basis:
      calculation?.basis ||
      '',

    reason:
      input.declarationReason ||
      '',
  }
}

export async function declareProductFoodIntelligence(
  productVersionId,
  input,
  actorUser,
) {
  const actorUserId =
    stringId(
      actorUser,
    )

  if (!actorUserId) {
    throw new ApiError(
      401,
      'Authenticated Product declaration actor is required.',
      [
        {
          code:
            'FOOD_PRODUCT_DECLARATION_ACTOR_REQUIRED',
        },
      ],
    )
  }

  const productVersion =
    await ProductVersion
      .findById(
        productVersionId,
      )
      .lean()

  assertProductVersionFoodIntelligenceEligible(
    productVersion,
  )

  const nutrientRows =
    []

  for (
    const item
    of input.nutrition
  ) {
    const nutrient =
      await ensureDeclaredProductNutrient(
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
        input.nutritionBasis,

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
      await ensureDeclaredProductAllergen(
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
    input.dietary.map(
      (
        item,
      ) => ({
        ruleKey:
          item.key,

        outcome:
          item.outcome,

        evidenceState:
          'operator_declared',

        reasonCodes: [
          'SUPER_ADMIN_PRODUCT_DIETARY_DECLARATION',
        ],
      }),
    )

  const evidenceSourceVersions =
    await loadProductDeclarationEvidenceSources(
      productVersion._id,
    )

  const sourceVersions = [
    {
      sourceType:
        'product_version',

      sourceId:
        stringId(
          productVersion,
        ),

      version:
        resolveProductVersionNumber(
          productVersion,
        ),

      evidenceState:
        'operator_declared',

      evidenceSourceId:
        null,
    },

    ...evidenceSourceVersions,
  ]

  const previousApproved =
    await FoodCalculation
      .findOne({
        entityType:
          'product_version',

        entityId:
          productVersion._id,

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

  let attempt =
    0

  while (
    attempt <
    2
  ) {
    const calculationVersion =
      await nextFoodCalculationVersion({
        entityType:
          'product_version',

        entityId:
          productVersion._id,
      })

    const snapshot =
      buildFoodCalculationSnapshot({
        entityType:
          'product_version',

        entityId:
          productVersion._id,

        calculationVersion,

        engineVersion:
          'm08.2-super-admin-product-declaration',

        sourceVersions,

        ruleProfileVersions:
          [],

        inputs: [
          {
            jurisdictionCode:
              input.jurisdictionCode,

            declarationType:
              'super_admin_product_declaration',

            declarationReason:
              input.reason,

            nutritionBasis:
              input.nutritionBasis,

            nutrition:
              input.nutrition,

            allergens:
              input.allergens,

            allergenStatement:
              input.allergenStatement,

            dietary:
              input.dietary,
          },
        ],

        assumptions: [
          {
            declarationBoundary:
              'Product-level values are Super Admin declared from reviewed canonical ProductVersion and package/Host evidence. They are not laboratory verification and do not generate free-from claims.',
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
      const calculation =
        await FoodCalculation.create({
          ...snapshot,

          status:
            'approved',

          generatedByUserId:
            actorUserId,

          approvedByUserId:
            actorUserId,

          approvedAt:
            new Date(),

          supersedesCalculationId:
            previousApproved?._id ||
            null,
        })

      return {
        productVersion: {
          id:
            stringId(
              productVersion,
            ),

          status:
            resolveProductVersionFoodStatus(
              productVersion,
            ),

          version:
            resolveProductVersionNumber(
              productVersion,
            ),

          displayName:
            productVersion.displayName ||
            '',
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
    'Unable to allocate Product Food Intelligence declaration version.',
    [
      {
        code:
          'FOOD_PRODUCT_DECLARATION_VERSION_CONFLICT',
      },
    ],
  )
}

export async function getLatestProductFoodIntelligenceDeclaration(
  productVersionId,
) {
  const productVersion =
    await ProductVersion
      .findById(
        productVersionId,
      )
      .lean()

  if (!productVersion) {
    throw new ApiError(
      404,
      'Product Version not found.',
      [
        {
          code:
            'FOOD_PRODUCT_VERSION_NOT_FOUND',
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
            'product_version',

          entityId:
            productVersion._id,
        })
        .sort({
          calculationVersion:
            -1,
        })
        .lean(),

      FoodCalculation
        .findOne({
          entityType:
            'product_version',

          entityId:
            productVersion._id,

          status:
            'approved',
        })
        .sort({
          calculationVersion:
            -1,
        })
        .lean(),
    ])

  const serialize =
    (
      calculation,
    ) => {
      if (!calculation) {
        return null
      }

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

        declaration:
          declarationInputFromCalculation(
            calculation,
          ),
      }
    }

  const packageAllergenStatement =
    await readApprovedNpiAllergenStatement(
      productVersion._id,
    )

  return {
    productVersion: {
      id:
        stringId(
          productVersion,
        ),

      version:
        resolveProductVersionNumber(
          productVersion,
        ),

      status:
        resolveProductVersionFoodStatus(
          productVersion,
        ),

      displayName:
        productVersion.displayName ||
        '',
    },

    latest:
      serialize(
        latest,
      ),

    latestApproved:
      serialize(
        latestApproved,
      ),

    packageEvidence: {
      allergenStatement:
        packageAllergenStatement,
    },
  }
}
