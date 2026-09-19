import crypto from 'crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  Allergen,
  FoodCalculation,
  Nutrient,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  Dish,
  RecipeIngredient,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  HospitalityMenu,
  HospitalityMenuItem,
  HospitalityOutlet,
  HospitalityProductionRecipeIngredient,
  HospitalityProductionRecipeVersion,
  HospitalitySupplierProduct,
} from './hospitality.models.js'

import {
  resolveHospitalityContext,
} from './hospitality.service.js'

import {
  DishPassportSnapshot,
  HospitalityChangeCase,
  HospitalityGreyBookSnapshot,
} from './hospitality.passport.models.js'

function id(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Host identity is required.',
      [
        {
          code:
            'HOSPITALITY_HOST_IDENTITY_REQUIRED',
        },
      ],
    )
  }

  return value
}

function normalizeEvidence(values) {
  const result = []
  const seen = new Set()

  for (
    const item of
    Array.isArray(values)
      ? values
      : []
  ) {
    const key = [
      item.type,
      item.label,
      item.referenceId,
      item.uri,
      item.note,
    ].join('|')

    if (
      seen.has(key)
    ) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function stableValue(value) {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      stableValue,
    )
  }

  if (
    value &&
    typeof value ===
      'object' &&
    !(value instanceof Date)
  ) {
    return Object.keys(value)
      .sort()
      .reduce(
        (
          output,
          key,
        ) => {
          output[key] =
            stableValue(
              value[key],
            )

          return output
        },
        {},
      )
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString()
  }

  return value
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        stableValue(value),
      ),
    )
    .digest('hex')
}

function passportKey({
  organizationId,
  outletId,
  recipeKey,
}) {
  const digest =
    crypto
      .createHash('sha256')
      .update(
        [
          id(organizationId),
          id(outletId),
          String(recipeKey || ''),
        ].join(':'),
      )
      .digest('hex')
      .slice(0, 24)

  return `dp_${digest}`
}

function greyBookKey({
  organizationId,
  outletId,
}) {
  const digest =
    crypto
      .createHash('sha256')
      .update(
        [
          id(organizationId),
          id(outletId),
        ].join(':'),
      )
      .digest('hex')
      .slice(0, 24)

  return `gb_${digest}`
}

function hasPermission(
  context,
  permissionKey,
) {
  return (
    context.isOrganizationOwner ===
      true ||
    context.permissionKeys.includes(
      permissionKey,
    )
  )
}

function assertPermission(
  context,
  permissionKey,
) {
  if (
    hasPermission(
      context,
      permissionKey,
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'Hospitality permission is required for this operation.',
    [
      {
        code:
          'HOSPITALITY_PERMISSION_REQUIRED',

        permissionKey,
      },
    ],
  )
}

function assertOutletScope(
  context,
  outletId,
) {
  if (
    context.isOrganizationOwner ===
      true ||
    context.outletIds.length ===
      0
  ) {
    return
  }

  if (
    context.outletIds.includes(
      id(outletId),
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'This Hospitality operator is not scoped to the requested outlet.',
    [
      {
        code:
          'HOSPITALITY_OUTLET_SCOPE_REQUIRED',

        outletId:
          id(outletId),
      },
    ],
  )
}

async function requireOutlet(
  context,
  outletId,
) {
  assertOutletScope(
    context,
    outletId,
  )

  const outlet =
    await HospitalityOutlet.findOne({
      _id:
        outletId,

      organizationId:
        context.organization._id,

      status:
        'active',
    })

  if (!outlet) {
    throw new ApiError(
      404,
      'Active Hospitality outlet was not found in this organization.',
      [
        {
          code:
            'HOSPITALITY_OUTLET_NOT_FOUND',
        },
      ],
    )
  }

  return outlet
}

function serializePassport(
  value,
  {
    publicView = false,
  } = {},
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  if (
    publicView
  ) {
    return {
      publicId:
        item.passportKey,

      versionNumber:
        item.versionNumber,

      verificationState:
        item.verificationState,

      effectiveFrom:
        item.effectiveFrom ||
        null,

      generatedAt:
        item.generatedAt ||
        null,

      publishedAt:
        item.publishedAt ||
        null,

      dish:
        item.snapshot?.dish ||
        null,

      outlet:
        item.snapshot?.outlet ||
        null,

      serving:
        item.snapshot?.serving ||
        null,

      ingredients:
        item.snapshot?.ingredients ||
        [],

      allergens:
        item.snapshot?.allergens ||
        [],

      nutrition:
        item.snapshot?.nutrition ||
        null,

      dietary:
        item.snapshot?.dietary ||
        [],

      provenance:
        item.snapshot?.publicProvenance ||
        [],

      governance: {
        ...(
          item.snapshot?.publicGovernance ||
          {}
        ),
        approvedAt:
          item.approvedAt ||
          null,
        publishedAt:
          item.publishedAt ||
          null,
        passportVersionNumber:
          item.versionNumber,
      },
    }
  }

  return {
    id:
      id(
        item._id,
      ),

    passportKey:
      item.passportKey,

    publicId:
      item.passportKey,

    versionNumber:
      item.versionNumber,

    organizationId:
      id(
        item.organizationId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    productionRecipeVersionId:
      id(
        item.productionRecipeVersionId,
      ),

    dishId:
      id(
        item.dishId,
      ),

    sourceRecipeVersionId:
      id(
        item.sourceRecipeVersionId,
      ),

    foodCalculationId:
      id(
        item.foodCalculationId,
      ),

    changeCaseId:
      id(
        item.changeCaseId,
      ),

    status:
      item.status,

    visibility:
      item.visibility,

    verificationState:
      item.verificationState,

    sourceFingerprint:
      item.sourceFingerprint,

    snapshot:
      item.snapshot,

    effectiveFrom:
      item.effectiveFrom ||
      null,

    effectiveTo:
      item.effectiveTo ||
      null,

    supersedesSnapshotId:
      id(
        item.supersedesSnapshotId,
      ),

    generatedAt:
      item.generatedAt ||
      null,

    approvedAt:
      item.approvedAt ||
      null,

    publishedAt:
      item.publishedAt ||
      null,

    retiredAt:
      item.retiredAt ||
      null,
  }
}

function serializeGreyBook(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id,
      ),

    greyBookKey:
      item.greyBookKey,

    versionNumber:
      item.versionNumber,

    organizationId:
      id(
        item.organizationId,
      ),

    outletId:
      id(
        item.outletId,
      ),

    changeCaseId:
      id(
        item.changeCaseId,
      ),

    effectiveAt:
      item.effectiveAt,

    passportSnapshotIds:
      (
        item.passportSnapshotIds ||
        []
      ).map(id),

    sourceFingerprint:
      item.sourceFingerprint,

    snapshot:
      item.snapshot,

    generatedAt:
      item.generatedAt,
  }
}

function serializeChangeCase(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id,
      ),

    caseKey:
      item.caseKey,

    organizationId:
      id(
        item.organizationId,
      ),

    source:
      item.source,

    changedDomains:
      item.changedDomains ||
      [],

    severity:
      item.severity,

    status:
      item.status,

    reason:
      item.reason,

    evidence:
      item.evidence ||
      [],

    impactedProductionRecipeVersionIds:
      (
        item.impactedProductionRecipeVersionIds ||
        []
      ).map(id),

    impactedMenuIds:
      (
        item.impactedMenuIds ||
        []
      ).map(id),

    impactedOutletIds:
      (
        item.impactedOutletIds ||
        []
      ).map(id),

    baselinePassportSnapshotIds:
      (
        item.baselinePassportSnapshotIds ||
        []
      ).map(id),

    candidatePassportSnapshotIds:
      (
        item.candidatePassportSnapshotIds ||
        []
      ).map(id),

    baselineGreyBookSnapshotIds:
      (
        item.baselineGreyBookSnapshotIds ||
        []
      ).map(id),

    generatedGreyBookSnapshotIds:
      (
        item.generatedGreyBookSnapshotIds ||
        []
      ).map(id),

    recalculationNotes:
      item.recalculationNotes ||
      [],

    recalculatedAt:
      item.recalculatedAt ||
      null,

    approvedAt:
      item.approvedAt ||
      null,

    publishedAt:
      item.publishedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,
  }
}

async function loadApprovedFoodCalculation(
  sourceRecipeVersionId,
) {
  const calculation =
    await FoodCalculation.findOne({
      entityType:
        'recipe_version',

      entityId:
        sourceRecipeVersionId,

      status:
        'approved',
    })
      .sort({
        calculationVersion:
          -1,
      })
      .lean()

  if (!calculation) {
    throw new ApiError(
      409,
      'Dish Passport requires an approved M08 Food Calculation for the linked M07 Recipe Version.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_APPROVED_FOOD_CALCULATION_REQUIRED',
        },
      ],
    )
  }

  return calculation
}

function calculateVerificationState(
  calculation,
) {
  const evidenceUnsafe =
    [
      'inferred',
      'unknown_review_required',
    ].includes(
      calculation.evidenceState,
    )

  const allergenUnsafe =
    (
      calculation.allergens ||
      []
    ).some(
      (item) =>
        item.outcome ===
          'unknown_review_required' ||
        item.evidenceState ===
          'unknown_review_required',
    )

  const dietaryUnsafe =
    (
      calculation.dietary ||
      []
    ).some(
      (item) =>
        item.outcome ===
          'unknown_review_required' ||
        item.evidenceState ===
          'unknown_review_required',
    )

  return (
    evidenceUnsafe ||
    allergenUnsafe ||
    dietaryUnsafe
  )
    ? 'requires_verification'
    : 'verified'
}

async function buildPassportProjection({
  context,
  outletId,
  productionRecipeVersionId,
}) {
  const outlet =
    await requireOutlet(
      context,
      outletId,
    )

  const productionRecipe =
    await HospitalityProductionRecipeVersion.findOne({
      _id:
        productionRecipeVersionId,

      organizationId:
        context.organization._id,

      status:
        'approved',
    }).lean()

  if (!productionRecipe) {
    throw new ApiError(
      409,
      'Dish Passport requires an approved Hospitality Production Recipe Version.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_APPROVED_PRODUCTION_RECIPE_REQUIRED',
        },
      ],
    )
  }

  if (
    !productionRecipe.dishId ||
    !productionRecipe.sourceRecipeVersionId
  ) {
    throw new ApiError(
      409,
      'Dish Passport requires the Production Recipe to retain M07 Dish and published Recipe Version lineage.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_M07_LINEAGE_REQUIRED',
        },
      ],
    )
  }

  const [
    dish,
    sourceRecipe,
  ] =
    await Promise.all([
      Dish.findOne({
        _id:
          productionRecipe.dishId,

        status:
          'active',
      }).lean(),

      RecipeVersion.findOne({
        _id:
          productionRecipe.sourceRecipeVersionId,

        dishId:
          productionRecipe.dishId,

        status:
          'published',
      }).lean(),
    ])

  if (
    !dish ||
    !sourceRecipe
  ) {
    throw new ApiError(
      409,
      'Dish Passport requires an active M07 Dish and published linked Recipe Version.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_PUBLISHED_RECIPE_REQUIRED',
        },
      ],
    )
  }

  const foodCalculation =
    await loadApprovedFoodCalculation(
      sourceRecipe._id,
    )

  const ingredientLines =
    await HospitalityProductionRecipeIngredient.find({
      organizationId:
        context.organization._id,

      productionRecipeVersionId:
        productionRecipe._id,
    })
      .sort({
        lineNumber:
          1,
      })
      .lean()

  if (
    ingredientLines.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Dish Passport requires Production Recipe ingredient lines.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_INGREDIENTS_REQUIRED',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Safety lineage equivalence
  |--------------------------------------------------------------------------
  |
  | M08 FoodCalculation is attached to the linked M07 RecipeVersion. M18 must
  | never combine a different Production Recipe formulation with that safety
  | calculation. Ingredient identity, unit, optional state and per-serving
  | quantity therefore have to remain equivalent before Passport generation.
  |--------------------------------------------------------------------------
  */

  const sourceIngredients =
    await RecipeIngredient.find({
      recipeVersionId:
        sourceRecipe._id,
    })
      .sort({
        lineNumber:
          1,
      })
      .lean()

  const sourceByIngredient =
    new Map(
      sourceIngredients.map(
        (item) => [
          id(
            item.canonicalIngredientId,
          ),
          item,
        ],
      ),
    )

  const productionByIngredient =
    new Map(
      ingredientLines.map(
        (item) => [
          id(
            item.canonicalIngredientId,
          ),
          item,
        ],
      ),
    )

  const sameIngredientSet =
    sourceByIngredient.size ===
      productionByIngredient.size &&
    [
      ...sourceByIngredient.keys(),
    ].every(
      (ingredientId) =>
        productionByIngredient.has(
          ingredientId,
        ),
    )

  let formulationEquivalent =
    sameIngredientSet

  if (
    formulationEquivalent
  ) {
    for (
      const [
        ingredientId,
        sourceIngredient,
      ] of sourceByIngredient.entries()
    ) {
      const productionIngredient =
        productionByIngredient.get(
          ingredientId,
        )

      const sourcePerServing =
        Number(
          sourceIngredient.quantity,
        ) /
        Number(
          sourceRecipe.baseServings,
        )

      const productionPerServing =
        Number(
          productionIngredient.quantity,
        ) /
        Number(
          productionRecipe.baseYieldPortions,
        )

      const quantityEquivalent =
        Number.isFinite(
          sourcePerServing,
        ) &&
        Number.isFinite(
          productionPerServing,
        ) &&
        Math.abs(
          sourcePerServing -
          productionPerServing,
        ) <=
          1e-8

      if (
        sourceIngredient.unit !==
          productionIngredient.unit ||
        Boolean(
          sourceIngredient.optional,
        ) !==
          Boolean(
            productionIngredient.optional,
          ) ||
        !quantityEquivalent
      ) {
        formulationEquivalent =
          false
        break
      }
    }
  }

  if (
    !formulationEquivalent
  ) {
    throw new ApiError(
      409,
      'Production Recipe formulation differs from the M07 RecipeVersion used by the approved M08 Food Calculation.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_SOURCE_RECIPE_MISMATCH_RECALCULATION_REQUIRED',
        },
      ],
    )
  }

  const canonicalIngredientIds = [
    ...new Set(
      ingredientLines.map(
        (item) =>
          id(
            item.canonicalIngredientId,
          ),
      ),
    ),
  ]

  const canonicalIngredients =
    await CanonicalIngredient.find({
      _id: {
        $in:
          canonicalIngredientIds,
      },
    })
      .select(
        '_id canonicalName slug',
      )
      .lean()

  const canonicalIngredientMap =
    new Map(
      canonicalIngredients.map(
        (item) => [
          id(
            item._id,
          ),
          item,
        ],
      ),
    )

  const preferredSupplierProductIds = [
    ...new Set(
      ingredientLines
        .map(
          (item) =>
            id(
              item.preferredSupplierProductId,
            ),
        )
        .filter(Boolean),
    ),
  ]

  const supplierProducts =
    preferredSupplierProductIds.length
      ? await HospitalitySupplierProduct.find({
          _id: {
            $in:
              preferredSupplierProductIds,
          },

          organizationId:
            context.organization._id,
        })
          .select(
            '_id supplierId supplierSku versionNumber canonicalPackId canonicalIngredientId',
          )
          .lean()
      : []

  const supplierProductMap =
    new Map(
      supplierProducts.map(
        (item) => [
          id(
            item._id,
          ),
          item,
        ],
      ),
    )

  const canonicalPackIds = [
    ...new Set(
      supplierProducts
        .map(
          (item) =>
            id(
              item.canonicalPackId,
            ),
        )
        .filter(Boolean),
    ),
  ]

  const productVersions =
    canonicalPackIds.length
      ? await ProductVersion.find({
          packId: {
            $in:
              canonicalPackIds,
          },

          publicationStatus:
            'published',
        })
          .sort({
            version:
              -1,
          })
          .lean()
      : []

  const productVersionByPack =
    new Map()

  for (
    const productVersion of
    productVersions
  ) {
    const key =
      id(
        productVersion.packId,
      )

    if (
      !productVersionByPack.has(
        key,
      )
    ) {
      productVersionByPack.set(
        key,
        productVersion,
      )
    }
  }

  const allergenIds = [
    ...new Set(
      (
        foodCalculation.allergens ||
        []
      ).map(
        (item) =>
          id(
            item.allergenId,
          ),
      ),
    ),
  ]

  const nutrientIds = [
    ...new Set(
      (
        foodCalculation.nutrients ||
        []
      ).map(
        (item) =>
          id(
            item.nutrientId,
          ),
      ),
    ),
  ]

  const [
    allergens,
    nutrients,
  ] =
    await Promise.all([
      allergenIds.length
        ? Allergen.find({
            _id: {
              $in:
                allergenIds,
            },
          })
            .select(
              '_id canonicalName key',
            )
            .lean()
        : [],

      nutrientIds.length
        ? Nutrient.find({
            _id: {
              $in:
                nutrientIds,
            },
          })
            .select(
              '_id canonicalName key defaultUnit',
            )
            .lean()
        : [],
    ])

  const allergenMap =
    new Map(
      allergens.map(
        (item) => [
          id(
            item._id,
          ),
          item,
        ],
      ),
    )

  const nutrientMap =
    new Map(
      nutrients.map(
        (item) => [
          id(
            item._id,
          ),
          item,
        ],
      ),
    )

  const ingredientSnapshot =
    ingredientLines.map(
      (line) => {
        const ingredient =
          canonicalIngredientMap.get(
            id(
              line.canonicalIngredientId,
            ),
          )

        const supplierProduct =
          supplierProductMap.get(
            id(
              line.preferredSupplierProductId,
            ),
          )

        const productVersion =
          supplierProduct?.canonicalPackId
            ? productVersionByPack.get(
                id(
                  supplierProduct.canonicalPackId,
                ),
              )
            : null

        return {
          lineNumber:
            line.lineNumber,

          canonicalIngredientId:
            id(
              line.canonicalIngredientId,
            ),

          canonicalName:
            ingredient?.canonicalName ||
            'Unknown ingredient',

          quantity:
            line.quantity,

          unit:
            line.unit,

          expectedWastePercentage:
            line.expectedWastePercentage,

          optional:
            line.optional ===
            true,

          supplierProductId:
            id(
              supplierProduct?._id,
            ),

          supplierProductVersionNumber:
            supplierProduct?.versionNumber ||
            null,

          productVersionId:
            id(
              productVersion?._id,
            ),

          productVersionNumber:
            productVersion?.version ||
            null,
        }
      },
    )

  const allergenSnapshot =
    (
      foodCalculation.allergens ||
      []
    ).map(
      (item) => {
        const allergen =
          allergenMap.get(
            id(
              item.allergenId,
            ),
          )

        return {
          allergenId:
            id(
              item.allergenId,
            ),

          name:
            allergen?.canonicalName ||
            allergen?.key ||
            'Unknown allergen',

          outcome:
            item.outcome,

          evidenceState:
            item.evidenceState,
        }
      },
    )

  const nutrientSnapshot =
    (
      foodCalculation.nutrients ||
      []
    ).map(
      (item) => {
        const nutrient =
          nutrientMap.get(
            id(
              item.nutrientId,
            ),
          )

        return {
          nutrientId:
            id(
              item.nutrientId,
            ),

          name:
            nutrient?.canonicalName ||
            nutrient?.key ||
            'Unknown nutrient',

          amount:
            item.amount,

          unit:
            item.unit,

          basis:
            item.basis,

          evidenceState:
            item.evidenceState,
        }
      },
    )

  const dietarySnapshot =
    (
      foodCalculation.dietary ||
      []
    ).map(
      (item) => ({
        ruleKey:
          item.ruleKey,

        outcome:
          item.outcome,

        evidenceState:
          item.evidenceState,

        reasonCodes:
          item.reasonCodes ||
          [],
      }),
    )

  const verificationState =
    calculateVerificationState(
      foodCalculation,
    )

  const sourceVersions = [
    {
      sourceType:
        'hospitality_production_recipe_version',

      sourceId:
        id(
          productionRecipe._id,
        ),

      version:
        String(
          productionRecipe.versionNumber,
        ),
    },

    {
      sourceType:
        'recipe_version',

      sourceId:
        id(
          sourceRecipe._id,
        ),

      version:
        String(
          sourceRecipe.versionNumber,
        ),
    },

    {
      sourceType:
        'food_calculation',

      sourceId:
        id(
          foodCalculation._id,
        ),

      version:
        String(
          foodCalculation.calculationVersion,
        ),
    },

    ...ingredientSnapshot
      .filter(
        (item) =>
          item.productVersionId,
      )
      .map(
        (item) => ({
          sourceType:
            'product_version',

          sourceId:
            item.productVersionId,

          version:
            String(
              item.productVersionNumber,
            ),
        }),
      ),
  ]

  const projection = {
    dish: {
      id:
        id(
          dish._id,
        ),

      name:
        dish.name,

      slug:
        dish.slug,

      description:
        dish.description ||
        '',

      cuisine:
        dish.cuisine ||
        '',

      course:
        dish.course ||
        '',
    },

    outlet: {
      id:
        id(
          outlet._id,
        ),

      code:
        outlet.outletCode,

      name:
        outlet.name,
    },

    serving: {
      productionBaseYieldPortions:
        productionRecipe.baseYieldPortions,

      productionUnit:
        productionRecipe.productionUnit,

      recipeBaseServings:
        sourceRecipe.baseServings,

      servingSizeAmount:
        sourceRecipe.servingSizeAmount,

      servingSizeUnit:
        sourceRecipe.servingSizeUnit,
    },

    ingredients:
      ingredientSnapshot,

    allergens:
      allergenSnapshot,

    nutrition: {
      basis:
        foodCalculation.basis,

      nutrients:
        nutrientSnapshot,

      calculationVersion:
        foodCalculation.calculationVersion,

      engineVersion:
        foodCalculation.engineVersion,

      evidenceState:
        foodCalculation.evidenceState,
    },

    dietary:
      dietarySnapshot,

    sourceVersions,

    ruleProfileVersions:
      foodCalculation.ruleProfileVersions ||
      [],

    foodCalculationFingerprint:
      foodCalculation.fingerprint,

    publicProvenance:
      sourceVersions.map(
        (item) => ({
          sourceType:
            item.sourceType,

          sourceId:
            item.sourceId,

          version:
            item.version,
        }),
      ),

    publicGovernance: {
      calculationStatus:
        foodCalculation.status,

      verificationState,

      safetyPolicy:
        'unknown_allergen_evidence_fails_closed',
    },
  }

  return {
    outlet,
    productionRecipe,
    dish,
    sourceRecipe,
    foodCalculation,
    verificationState,
    projection,
    sourceFingerprint:
      fingerprint({
        productionRecipeVersionId:
          id(
            productionRecipe._id,
          ),

        sourceRecipeVersionId:
          id(
            sourceRecipe._id,
          ),

        foodCalculationId:
          id(
            foodCalculation._id,
          ),

        foodCalculationFingerprint:
          foodCalculation.fingerprint,

        projection,
      }),
  }
}

async function createPassportSnapshot({
  context,
  outletId,
  productionRecipeVersionId,
  changeCaseId,
  actorUser,
}) {
  const built =
    await buildPassportProjection({
      context,
      outletId,
      productionRecipeVersionId,
    })

  const key =
    passportKey({
      organizationId:
        context.organization._id,

      outletId,

      recipeKey:
        built.productionRecipe.recipeKey,
    })

  const latest =
    await DishPassportSnapshot.findOne({
      organizationId:
        context.organization._id,

      outletId,

      passportKey:
        key,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  const created =
    await DishPassportSnapshot.create({
      passportKey:
        key,

      versionNumber:
        Number(
          latest?.versionNumber ||
          0,
        ) +
        1,

      organizationId:
        context.organization._id,

      outletId,

      productionRecipeVersionId:
        built.productionRecipe._id,

      dishId:
        built.dish._id,

      sourceRecipeVersionId:
        built.sourceRecipe._id,

      foodCalculationId:
        built.foodCalculation._id,

      changeCaseId:
        changeCaseId ||
        null,

      status:
        'draft',

      visibility:
        'internal',

      verificationState:
        built.verificationState,

      sourceFingerprint:
        built.sourceFingerprint,

      snapshot:
        built.projection,

      supersedesSnapshotId:
        latest?._id ||
        null,

      generatedAt:
        new Date(),

      generatedByUserId:
        actorId(
          actorUser,
        ),
    })

  return created
}

export async function listDishPassportSnapshots({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.passports.read',
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    filter.outletId = {
      $in:
        context.outletIds,
    }
  }

  const records =
    await DishPassportSnapshot.find(
      filter,
    )
      .sort({
        generatedAt:
          -1,
      })
      .limit(300)
      .lean()

  return {
    dishPassports:
      records.map(
        (item) =>
          serializePassport(
            item,
          ),
      ),
  }
}

export async function generateDishPassportSnapshot({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.passports.generate',
  )

  await requireOutlet(
    context,
    input.outletId,
  )

  if (
    input.changeCaseId
  ) {
    const changeCase =
      await HospitalityChangeCase.findOne({
        _id:
          input.changeCaseId,

        organizationId:
          context.organization._id,
      }).lean()

    if (!changeCase) {
      throw new ApiError(
        404,
        'Hospitality Change Case was not found.',
        [
          {
            code:
              'HOSPITALITY_CHANGE_CASE_NOT_FOUND',
          },
        ],
      )
    }
  }

  const created =
    await createPassportSnapshot({
      context,
      outletId:
        input.outletId,
      productionRecipeVersionId:
        input.productionRecipeVersionId,
      changeCaseId:
        input.changeCaseId,
      actorUser,
    })

  return {
    dishPassport:
      serializePassport(
        created,
      ),

    policy: {
      projectionOnly:
        true,

      independentlyEditableTruth:
        false,

      unknownAllergenEvidenceFailsClosed:
        true,

      aiMayPublish:
        false,
    },
  }
}

async function requireOwnedPassport(
  context,
  snapshotId,
) {
  const snapshot =
    await DishPassportSnapshot.findOne({
      _id:
        snapshotId,

      organizationId:
        context.organization._id,
    })

  if (!snapshot) {
    throw new ApiError(
      404,
      'Dish Passport snapshot was not found.',
      [
        {
          code:
            'HOSPITALITY_DISH_PASSPORT_NOT_FOUND',
        },
      ],
    )
  }

  assertOutletScope(
    context,
    snapshot.outletId,
  )

  return snapshot
}

export async function approveDishPassportSnapshot({
  snapshotId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.passports.approve',
  )

  const snapshot =
    await requireOwnedPassport(
      context,
      snapshotId,
    )

  if (
    snapshot.status !==
    'draft'
  ) {
    throw new ApiError(
      409,
      'Only a draft Dish Passport snapshot may be approved.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_APPROVAL_STATE_INVALID',
        },
      ],
    )
  }

  if (
    snapshot.verificationState !==
    'verified'
  ) {
    throw new ApiError(
      409,
      'Dish Passport cannot be approved while allergen, dietary or source evidence requires verification.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_VERIFICATION_REQUIRED',
        },
      ],
    )
  }

  if (
    id(
      snapshot.generatedByUserId,
    ) ===
    id(
      actorId(
        actorUser,
      ),
    )
  ) {
    throw new ApiError(
      409,
      'Dish Passport approval requires a different checker from the generator.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_MAKER_CHECKER_REQUIRED',
        },
      ],
    )
  }

  snapshot.status =
    'approved'

  snapshot.approvedAt =
    new Date()

  snapshot.approvedByUserId =
    actorId(
      actorUser,
    )

  snapshot.governanceEvents.push({
    eventType:
      'approved',
    actorUserId:
      actorId(
        actorUser,
      ),
    reason:
      input.reason,
    evidence:
      normalizeEvidence(
        input.evidence,
      ),
    occurredAt:
      new Date(),
  })

  await snapshot.save()

  return {
    dishPassport:
      serializePassport(
        snapshot,
      ),

    decisionContext: {
      reason:
        input.reason,

      evidence:
        normalizeEvidence(
          input.evidence,
        ),
    },
  }
}

async function publishPassportDocument({
  context,
  snapshot,
  actorUser,
  approvedByUserId = null,
  reason = 'Governed publication',
  evidence = [],
}) {
  if (
    snapshot.status !==
      'approved' &&
    snapshot.status !==
      'draft'
  ) {
    throw new ApiError(
      409,
      'Only an approved governed Dish Passport snapshot may be published.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_PUBLISH_STATE_INVALID',
        },
      ],
    )
  }

  if (
    snapshot.verificationState !==
    'verified'
  ) {
    throw new ApiError(
      409,
      'Public Dish Passport publication fails closed while safety evidence requires verification.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_PUBLICATION_VERIFICATION_REQUIRED',
        },
      ],
    )
  }

  if (
    snapshot.status ===
    'draft'
  ) {
    if (
      !approvedByUserId ||
      id(
        approvedByUserId,
      ) ===
        id(
          snapshot.generatedByUserId,
        )
    ) {
      throw new ApiError(
        409,
        'Dish Passport publication requires an independent approval actor.',
        [
          {
            code:
              'HOSPITALITY_PASSPORT_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    snapshot.status =
      'approved'

    snapshot.approvedAt =
      new Date()

    snapshot.approvedByUserId =
      approvedByUserId
  }

  const now =
    new Date()

  const previousPublished =
    await DishPassportSnapshot.findOne({
      _id: {
        $ne:
          snapshot._id,
      },

      organizationId:
        context.organization._id,

      outletId:
        snapshot.outletId,

      passportKey:
        snapshot.passportKey,

      status:
        'published',
    })
      .sort({
        versionNumber:
          -1,
      })

  if (
    previousPublished
  ) {
    previousPublished.status =
      'retired'

    previousPublished.effectiveTo =
      now

    previousPublished.retiredAt =
      now

    previousPublished.governanceEvents.push({
      eventType:
        'retired',
      actorUserId:
        actorId(
          actorUser,
        ),
      reason:
        'Superseded by a newly published Dish Passport snapshot.',
      evidence:
        [],
      occurredAt:
        now,
    })

    await previousPublished.save()
  }

  snapshot.status =
    'published'

  snapshot.visibility =
    'public'

  snapshot.effectiveFrom =
    now

  snapshot.effectiveTo =
    null

  snapshot.publishedAt =
    now

  snapshot.publishedByUserId =
    actorId(
      actorUser,
    )

  snapshot.governanceEvents.push({
    eventType:
      'published',
    actorUserId:
      actorId(
        actorUser,
      ),
    reason,
    evidence:
      normalizeEvidence(
        evidence,
      ),
    occurredAt:
      now,
  })

  await snapshot.save()

  return snapshot
}

export async function publishDishPassportSnapshot({
  snapshotId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.passports.approve',
  )

  const snapshot =
    await requireOwnedPassport(
      context,
      snapshotId,
    )

  if (
    snapshot.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'Dish Passport must be approved before publication.',
      [
        {
          code:
            'HOSPITALITY_PASSPORT_APPROVAL_REQUIRED',
        },
      ],
    )
  }

  const published =
    await publishPassportDocument({
      context,
      snapshot,
      actorUser,
      reason:
        input.reason,
      evidence:
        input.evidence,
    })

  return {
    dishPassport:
      serializePassport(
        published,
      ),

    publicationContext: {
      reason:
        input.reason,

      evidence:
        normalizeEvidence(
          input.evidence,
        ),
    },

    policy: {
      previousPublishedSnapshotRetained:
        true,

      publicSnapshotContentImmutable:
        true,
    },
  }
}

export async function getPublicDishPassport(
  publicId,
) {
  const now =
    new Date()

  const snapshot =
    await DishPassportSnapshot.findOne({
      passportKey:
        publicId,

      status:
        'published',

      visibility:
        'public',

      verificationState:
        'verified',

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
        versionNumber:
          -1,
      })
      .lean()

  if (!snapshot) {
    throw new ApiError(
      404,
      'Published Dish Passport was not found.',
      [
        {
          code:
            'PUBLIC_DISH_PASSPORT_NOT_FOUND',
        },
      ],
    )
  }

  return {
    dishPassport:
      serializePassport(
        snapshot,
        {
          publicView:
            true,
        },
      ),
  }
}

async function publishedPassportsForOutlet({
  context,
  outletId,
  effectiveAt,
}) {
  const candidates =
    await DishPassportSnapshot.find({
      organizationId:
        context.organization._id,

      outletId,

      status:
        'published',

      visibility:
        'public',

      verificationState:
        'verified',

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
                  effectiveAt,
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
                  effectiveAt,
              },
            },
          ],
        },
      ],
    })
      .sort({
        passportKey:
          1,

        versionNumber:
          -1,
      })
      .lean()

  const latestByKey =
    new Map()

  for (
    const candidate of
    candidates
  ) {
    if (
      !latestByKey.has(
        candidate.passportKey,
      )
    ) {
      latestByKey.set(
        candidate.passportKey,
        candidate,
      )
    }
  }

  return [
    ...latestByKey.values(),
  ]
}

async function createGreyBookSnapshot({
  context,
  outletId,
  effectiveAt,
  changeCaseId,
  actorUser,
}) {
  const outlet =
    await requireOutlet(
      context,
      outletId,
    )

  const passports =
    await publishedPassportsForOutlet({
      context,
      outletId,
      effectiveAt,
    })

  if (
    passports.length ===
    0
  ) {
    throw new ApiError(
      409,
      'Grey Book requires at least one published verified Dish Passport for the selected outlet and effective date.',
      [
        {
          code:
            'HOSPITALITY_GREY_BOOK_PUBLISHED_PASSPORT_REQUIRED',
        },
      ],
    )
  }

  const key =
    greyBookKey({
      organizationId:
        context.organization._id,
      outletId,
    })

  const latest =
    await HospitalityGreyBookSnapshot.findOne({
      organizationId:
        context.organization._id,
      outletId,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  const entries =
    passports.map(
      (passport) => ({
        passportSnapshotId:
          id(
            passport._id,
          ),

        publicId:
          passport.passportKey,

        passportVersionNumber:
          passport.versionNumber,

        sourceFingerprint:
          passport.sourceFingerprint,

        dish:
          passport.snapshot?.dish ||
          null,

        serving:
          passport.snapshot?.serving ||
          null,

        ingredients:
          passport.snapshot?.ingredients ||
          [],

        allergens:
          passport.snapshot?.allergens ||
          [],

        nutrition:
          passport.snapshot?.nutrition ||
          null,

        dietary:
          passport.snapshot?.dietary ||
          [],

        publishedAt:
          passport.publishedAt ||
          null,
      }),
    )

  const snapshotPayload = {
    outlet: {
      id:
        id(
          outlet._id,
        ),
      code:
        outlet.outletCode,
      name:
        outlet.name,
    },

    effectiveAt:
      effectiveAt.toISOString(),

    entries,

    policy: {
      containsOnlyPublishedVerifiedPassports:
        true,

      unknownAllergenEvidenceFailsClosed:
        true,
    },
  }

  return HospitalityGreyBookSnapshot.create({
    greyBookKey:
      key,

    versionNumber:
      Number(
        latest?.versionNumber ||
        0,
      ) +
      1,

    organizationId:
      context.organization._id,

    outletId,

    changeCaseId:
      changeCaseId ||
      null,

    effectiveAt,

    passportSnapshotIds:
      passports.map(
        (passport) =>
          passport._id,
      ),

    sourceFingerprint:
      fingerprint(
        entries.map(
          (entry) => ({
            passportSnapshotId:
              entry.passportSnapshotId,
            sourceFingerprint:
              entry.sourceFingerprint,
          }),
        ),
      ),

    snapshot:
      snapshotPayload,

    generatedAt:
      new Date(),

    generatedByUserId:
      actorId(
        actorUser,
      ),
  })
}

export async function generateGreyBookSnapshot({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.grey_book.generate',
  )

  const created =
    await createGreyBookSnapshot({
      context,
      outletId:
        input.outletId,
      effectiveAt:
        input.effectiveAt,
      changeCaseId:
        input.changeCaseId,
      actorUser,
    })

  return {
    greyBook:
      serializeGreyBook(
        created,
      ),

    policy: {
      passportVersionsPinned:
        true,

      historyImmutable:
        true,
    },
  }
}

export async function listGreyBookSnapshots({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.grey_book.read',
  )

  const filter = {
    organizationId:
      context.organization._id,
  }

  if (
    context.isOrganizationOwner !==
      true &&
    context.outletIds.length >
      0
  ) {
    filter.outletId = {
      $in:
        context.outletIds,
    }
  }

  const records =
    await HospitalityGreyBookSnapshot.find(
      filter,
    )
      .sort({
        generatedAt:
          -1,
      })
      .limit(200)
      .lean()

  return {
    greyBooks:
      records.map(
        serializeGreyBook,
      ),
  }
}

export async function getGreyBookSnapshot({
  snapshotId,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.grey_book.read',
  )

  const record =
    await HospitalityGreyBookSnapshot.findOne({
      _id:
        snapshotId,

      organizationId:
        context.organization._id,
    }).lean()

  if (!record) {
    throw new ApiError(
      404,
      'Grey Book snapshot was not found.',
      [
        {
          code:
            'HOSPITALITY_GREY_BOOK_NOT_FOUND',
        },
      ],
    )
  }

  assertOutletScope(
    context,
    record.outletId,
  )

  return {
    greyBook:
      serializeGreyBook(
        record,
      ),
  }
}

export function greyBookCsv(
  greyBook,
) {
  const rows = [
    [
      'Dish',
      'Passport Public ID',
      'Passport Version',
      'Allergen',
      'Allergen Outcome',
      'Dietary Rule',
      'Dietary Outcome',
    ],
  ]

  for (
    const entry of
    greyBook.snapshot?.entries ||
    []
  ) {
    const allergens =
      entry.allergens?.length
        ? entry.allergens
        : [
            {
              name:
                '',
              outcome:
                '',
            },
          ]

    const dietary =
      entry.dietary?.length
        ? entry.dietary
        : [
            {
              ruleKey:
                '',
              outcome:
                '',
            },
          ]

    const maxRows =
      Math.max(
        allergens.length,
        dietary.length,
      )

    for (
      let index = 0;
      index < maxRows;
      index += 1
    ) {
      rows.push([
        entry.dish?.name ||
          '',
        entry.publicId ||
          '',
        entry.passportVersionNumber ||
          '',
        allergens[index]?.name ||
          '',
        allergens[index]?.outcome ||
          '',
        dietary[index]?.ruleKey ||
          '',
        dietary[index]?.outcome ||
          '',
      ])
    }
  }

  const escape =
    (value) =>
      `"${String(value ?? '')
        .replaceAll('"', '""')}"`

  return rows
    .map(
      (row) =>
        row
          .map(escape)
          .join(','),
    )
    .join('\n')
}

function changeSeverity(
  changedDomains,
) {
  const values =
    new Set(
      changedDomains,
    )

  if (
    values.has(
      'allergen',
    )
  ) {
    return 'allergen_critical'
  }

  if (
    values.has(
      'nutrition',
    ) ||
    values.has(
      'dietary',
    )
  ) {
    return 'regulatory_review'
  }

  if (
    values.has(
      'formulation',
    ) ||
    values.has(
      'ingredient',
    ) ||
    values.has(
      'recipe',
    )
  ) {
    return 'dietary'
  }

  if (
    values.has(
      'commercial',
    )
  ) {
    return 'commercial'
  }

  return 'informational'
}

async function impactedProductionRecipes({
  context,
  sourceType,
  sourceId,
}) {
  if (
    sourceType ===
    'production_recipe_version'
  ) {
    const recipe =
      await HospitalityProductionRecipeVersion.findOne({
        _id:
          sourceId,

        organizationId:
          context.organization._id,
      })
        .select('_id')
        .lean()

    return recipe
      ? [
          id(
            recipe._id,
          ),
        ]
      : []
  }

  if (
    sourceType ===
    'recipe_version'
  ) {
    const recipes =
      await HospitalityProductionRecipeVersion.find({
        organizationId:
          context.organization._id,

        sourceRecipeVersionId:
          sourceId,
      })
        .select('_id')
        .lean()

    return recipes.map(
      (item) =>
        id(
          item._id,
        ),
    )
  }

  let ingredientIds = []
  let supplierProductIds = []

  if (
    sourceType ===
    'canonical_ingredient'
  ) {
    ingredientIds = [
      sourceId,
    ]
  }

  if (
    sourceType ===
    'supplier_product'
  ) {
    const supplierProduct =
      await HospitalitySupplierProduct.findOne({
        _id:
          sourceId,

        organizationId:
          context.organization._id,
      }).lean()

    if (
      !supplierProduct
    ) {
      return []
    }

    supplierProductIds = [
      id(
        supplierProduct._id,
      ),
    ]

    if (
      supplierProduct.canonicalIngredientId
    ) {
      ingredientIds.push(
        id(
          supplierProduct.canonicalIngredientId,
        ),
      )
    }
  }

  if (
    sourceType ===
    'product_version'
  ) {
    const productVersion =
      await ProductVersion.findById(
        sourceId,
      ).lean()

    if (
      !productVersion
    ) {
      return []
    }

    ingredientIds.push(
      ...(
        productVersion.ingredients ||
        []
      )
        .map(
          (item) =>
            id(
              item.ingredientId,
            ),
        )
        .filter(Boolean),
    )

    const supplierProducts =
      await HospitalitySupplierProduct.find({
        organizationId:
          context.organization._id,

        canonicalPackId:
          productVersion.packId,
      })
        .select('_id canonicalIngredientId')
        .lean()

    supplierProductIds.push(
      ...supplierProducts.map(
        (item) =>
          id(
            item._id,
          ),
      ),
    )

    ingredientIds.push(
      ...supplierProducts
        .map(
          (item) =>
            id(
              item.canonicalIngredientId,
            ),
        )
        .filter(Boolean),
    )
  }

  ingredientIds = [
    ...new Set(
      ingredientIds,
    ),
  ]

  supplierProductIds = [
    ...new Set(
      supplierProductIds,
    ),
  ]

  if (
    ingredientIds.length ===
      0 &&
    supplierProductIds.length ===
      0
  ) {
    return []
  }

  const lineFilter = {
    organizationId:
      context.organization._id,

    $or: [],
  }

  if (
    ingredientIds.length
  ) {
    lineFilter.$or.push({
      canonicalIngredientId: {
        $in:
          ingredientIds,
      },
    })
  }

  if (
    supplierProductIds.length
  ) {
    lineFilter.$or.push({
      preferredSupplierProductId: {
        $in:
          supplierProductIds,
      },
    })
  }

  const lines =
    await HospitalityProductionRecipeIngredient.find(
      lineFilter,
    )
      .select(
        'productionRecipeVersionId',
      )
      .lean()

  return [
    ...new Set(
      lines.map(
        (item) =>
          id(
            item.productionRecipeVersionId,
          ),
      ),
    ),
  ]
}

async function impactGraph({
  context,
  productionRecipeVersionIds,
}) {
  if (
    productionRecipeVersionIds.length ===
    0
  ) {
    return {
      productionRecipeVersionIds:
        [],
      menuIds:
        [],
      outletIds:
        [],
      passportSnapshotIds:
        [],
      greyBookSnapshotIds:
        [],
    }
  }

  const menuItems =
    await HospitalityMenuItem.find({
      organizationId:
        context.organization._id,

      productionRecipeVersionId: {
        $in:
          productionRecipeVersionIds,
      },

      status:
        'active',
    })
      .select(
        'menuId productionRecipeVersionId',
      )
      .lean()

  const menuIds = [
    ...new Set(
      menuItems.map(
        (item) =>
          id(
            item.menuId,
          ),
      ),
    ),
  ]

  const menus =
    menuIds.length
      ? await HospitalityMenu.find({
          _id: {
            $in:
              menuIds,
          },

          organizationId:
            context.organization._id,
        })
          .select('_id outletId')
          .lean()
      : []

  const outletIds = [
    ...new Set(
      menus.map(
        (item) =>
          id(
            item.outletId,
          ),
      ),
    ),
  ]

  const passports =
    await DishPassportSnapshot.find({
      organizationId:
        context.organization._id,

      productionRecipeVersionId: {
        $in:
          productionRecipeVersionIds,
      },

      status:
        'published',
    })
      .select('_id outletId')
      .lean()

  for (
    const passport of
    passports
  ) {
    outletIds.push(
      id(
        passport.outletId,
      ),
    )
  }

  const uniqueOutletIds = [
    ...new Set(
      outletIds,
    ),
  ]

  const greyBooks =
    uniqueOutletIds.length
      ? await HospitalityGreyBookSnapshot.find({
          organizationId:
            context.organization._id,

          outletId: {
            $in:
              uniqueOutletIds,
          },
        })
          .sort({
            versionNumber:
              -1,
          })
          .select('_id outletId')
          .lean()
      : []

  const latestGreyBookByOutlet =
    new Map()

  for (
    const greyBook of
    greyBooks
  ) {
    const key =
      id(
        greyBook.outletId,
      )

    if (
      !latestGreyBookByOutlet.has(
        key,
      )
    ) {
      latestGreyBookByOutlet.set(
        key,
        id(
          greyBook._id,
        ),
      )
    }
  }

  return {
    productionRecipeVersionIds,
    menuIds,
    outletIds:
      uniqueOutletIds,
    passportSnapshotIds:
      passports.map(
        (item) =>
          id(
            item._id,
          ),
      ),
    greyBookSnapshotIds: [
      ...latestGreyBookByOutlet.values(),
    ],
  }
}

export async function detectHospitalityChangeImpact({
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.change.manage',
  )

  const productionRecipeVersionIds =
    await impactedProductionRecipes({
      context,
      sourceType:
        input.sourceType,
      sourceId:
        input.sourceId,
    })

  const graph =
    await impactGraph({
      context,
      productionRecipeVersionIds,
    })

  for (
    const outletId of
    graph.outletIds
  ) {
    assertOutletScope(
      context,
      outletId,
    )
  }

  const created =
    await HospitalityChangeCase.create({
      organizationId:
        context.organization._id,

      source: {
        type:
          input.sourceType,
        id:
          input.sourceId,
        version:
          input.sourceVersion,
      },

      changedDomains: [
        ...new Set(
          input.changedDomains,
        ),
      ],

      severity:
        changeSeverity(
          input.changedDomains,
        ),

      status:
        'detected',

      reason:
        input.reason,

      evidence:
        normalizeEvidence(
          input.evidence,
        ),

      impactedProductionRecipeVersionIds:
        graph.productionRecipeVersionIds,

      impactedMenuIds:
        graph.menuIds,

      impactedOutletIds:
        graph.outletIds,

      baselinePassportSnapshotIds:
        graph.passportSnapshotIds,

      baselineGreyBookSnapshotIds:
        graph.greyBookSnapshotIds,

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    changeCase:
      serializeChangeCase(
        created,
      ),

    policy: {
      sourceTruthMutated:
        false,

      downstreamHistoryMutated:
        false,

      automaticPublication:
        false,
    },
  }
}

export async function listHospitalityChangeCases({
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.change.read',
  )

  const records =
    await HospitalityChangeCase.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt:
          -1,
      })
      .limit(250)
      .lean()

  return {
    changeCases:
      records
        .filter(
          (record) => {
            if (
              context.isOrganizationOwner ===
                true ||
              context.outletIds.length ===
                0
            ) {
              return true
            }

            return (
              record.impactedOutletIds ||
              []
            ).some(
              (outletId) =>
                context.outletIds.includes(
                  id(
                    outletId,
                  ),
                ),
            )
          },
        )
        .map(
          serializeChangeCase,
        ),
  }
}

async function requireChangeCase(
  context,
  changeCaseId,
) {
  const changeCase =
    await HospitalityChangeCase.findOne({
      _id:
        changeCaseId,

      organizationId:
        context.organization._id,
    })

  if (!changeCase) {
    throw new ApiError(
      404,
      'Hospitality Change Case was not found.',
      [
        {
          code:
            'HOSPITALITY_CHANGE_CASE_NOT_FOUND',
        },
      ],
    )
  }

  for (
    const outletId of
    changeCase.impactedOutletIds ||
    []
  ) {
    assertOutletScope(
      context,
      outletId,
    )
  }

  return changeCase
}

export async function recalculateHospitalityChangeCase({
  changeCaseId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.change.manage',
  )

  assertPermission(
    context,
    'hospitality.passports.generate',
  )

  const changeCase =
    await requireChangeCase(
      context,
      changeCaseId,
    )

  if (
    ![
      'detected',
      'blocked',
    ].includes(
      changeCase.status,
    )
  ) {
    throw new ApiError(
      409,
      'Change Case cannot be recalculated from its current state.',
      [
        {
          code:
            'HOSPITALITY_CHANGE_CASE_RECALCULATION_STATE_INVALID',
        },
      ],
    )
  }

  const menuItems =
    await HospitalityMenuItem.find({
      organizationId:
        context.organization._id,

      productionRecipeVersionId: {
        $in:
          changeCase.impactedProductionRecipeVersionIds,
      },

      status:
        'active',
    })
      .select(
        'menuId productionRecipeVersionId',
      )
      .lean()

  const menuIds = [
    ...new Set(
      menuItems.map(
        (item) =>
          id(
            item.menuId,
          ),
      ),
    ),
  ]

  const menus =
    menuIds.length
      ? await HospitalityMenu.find({
          _id: {
            $in:
              menuIds,
          },

          organizationId:
            context.organization._id,
        })
          .select('_id outletId')
          .lean()
      : []

  const outletByMenu =
    new Map(
      menus.map(
        (menu) => [
          id(
            menu._id,
          ),
          id(
            menu.outletId,
          ),
        ],
      ),
    )

  const pairs =
    new Map()

  for (
    const menuItem of
    menuItems
  ) {
    const outletId =
      outletByMenu.get(
        id(
          menuItem.menuId,
        ),
      )

    if (!outletId) {
      continue
    }

    const recipeId =
      id(
        menuItem.productionRecipeVersionId,
      )

    pairs.set(
      `${outletId}:${recipeId}`,
      {
        outletId,
        productionRecipeVersionId:
          recipeId,
      },
    )
  }

  for (
    const baselineId of
    changeCase.baselinePassportSnapshotIds ||
    []
  ) {
    const baseline =
      await DishPassportSnapshot.findById(
        baselineId,
      )
        .select(
          'outletId productionRecipeVersionId',
        )
        .lean()

    if (!baseline) {
      continue
    }

    const outletId =
      id(
        baseline.outletId,
      )

    const recipeId =
      id(
        baseline.productionRecipeVersionId,
      )

    pairs.set(
      `${outletId}:${recipeId}`,
      {
        outletId,
        productionRecipeVersionId:
          recipeId,
      },
    )
  }

  const candidateIds = []
  const notes = []

  for (
    const pair of
    pairs.values()
  ) {
    try {
      const created =
        await createPassportSnapshot({
          context,
          outletId:
            pair.outletId,
          productionRecipeVersionId:
            pair.productionRecipeVersionId,
          changeCaseId:
            changeCase._id,
          actorUser,
        })

      candidateIds.push(
        created._id,
      )

      notes.push({
        outletId:
          pair.outletId,
        productionRecipeVersionId:
          pair.productionRecipeVersionId,
        state:
          created.verificationState ===
            'verified'
            ? 'candidate_ready'
            : 'candidate_requires_verification',
        candidatePassportSnapshotId:
          id(
            created._id,
          ),
      })
    } catch (error) {
      notes.push({
        outletId:
          pair.outletId,
        productionRecipeVersionId:
          pair.productionRecipeVersionId,
        state:
          'blocked',
        code:
          error?.details?.[0]?.code ||
          error?.errors?.[0]?.code ||
          'HOSPITALITY_CHANGE_RECALCULATION_BLOCKED',
        message:
          error?.message ||
          'Recalculation blocked.',
      })
    }
  }

  changeCase.candidatePassportSnapshotIds =
    candidateIds

  changeCase.recalculationNotes =
    notes

  changeCase.evidence =
    normalizeEvidence([
      ...(changeCase.evidence || []),
      ...input.evidence,
    ])

  changeCase.reason =
    input.reason

  changeCase.recalculatedByUserId =
    actorId(
      actorUser,
    )

  changeCase.recalculatedAt =
    new Date()

  changeCase.status =
    notes.some(
      (note) =>
        note.state ===
          'blocked' ||
        note.state ===
          'candidate_requires_verification',
    )
      ? 'blocked'
      : 'recalculated'

  await changeCase.save()

  return {
    changeCase:
      serializeChangeCase(
        changeCase,
      ),
  }
}

export async function decideHospitalityChangeCase({
  changeCaseId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.change.approve',
  )

  const changeCase =
    await requireChangeCase(
      context,
      changeCaseId,
    )

  if (
    ![
      'recalculated',
      'blocked',
    ].includes(
      changeCase.status,
    )
  ) {
    throw new ApiError(
      409,
      'Change Case is not ready for a decision.',
      [
        {
          code:
            'HOSPITALITY_CHANGE_CASE_DECISION_STATE_INVALID',
        },
      ],
    )
  }

  if (
    input.decision ===
    'approve'
  ) {
    if (
      changeCase.status ===
      'blocked'
    ) {
      throw new ApiError(
        409,
        'Blocked Change Case cannot be approved until all safety-sensitive recalculations are verification-ready.',
        [
          {
            code:
              'HOSPITALITY_CHANGE_CASE_VERIFICATION_REQUIRED',
          },
        ],
      )
    }

    if (
      id(
        changeCase.createdByUserId,
      ) ===
      id(
        actorId(
          actorUser,
        ),
      )
    ) {
      throw new ApiError(
        409,
        'Change Case approval requires a different checker from the case creator.',
        [
          {
            code:
              'HOSPITALITY_CHANGE_CASE_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    changeCase.status =
      'approved'

    changeCase.approvedByUserId =
      actorId(
        actorUser,
      )

    changeCase.approvedAt =
      new Date()
  } else {
    changeCase.status =
      'dismissed'
  }

  changeCase.reason =
    input.reason

  changeCase.evidence =
    normalizeEvidence([
      ...(changeCase.evidence || []),
      ...input.evidence,
    ])

  await changeCase.save()

  return {
    changeCase:
      serializeChangeCase(
        changeCase,
      ),
  }
}

export async function publishHospitalityChangeCase({
  changeCaseId,
  input,
  actorUser,
  organizationIdHint,
}) {
  const context =
    await resolveHospitalityContext(
      actorUser,
      organizationIdHint,
    )

  assertPermission(
    context,
    'hospitality.change.approve',
  )

  assertPermission(
    context,
    'hospitality.passports.approve',
  )

  assertPermission(
    context,
    'hospitality.grey_book.generate',
  )

  const changeCase =
    await requireChangeCase(
      context,
      changeCaseId,
    )

  if (
    changeCase.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'Change Case must be approved before publication.',
      [
        {
          code:
            'HOSPITALITY_CHANGE_CASE_APPROVAL_REQUIRED',
        },
      ],
    )
  }

  const candidateSnapshots =
    await DishPassportSnapshot.find({
      _id: {
        $in:
          changeCase.candidatePassportSnapshotIds,
      },

      organizationId:
        context.organization._id,
    })

  if (
    candidateSnapshots.length !==
    changeCase.candidatePassportSnapshotIds.length
  ) {
    throw new ApiError(
      409,
      'Change Case candidate Passport set is incomplete.',
      [
        {
          code:
            'HOSPITALITY_CHANGE_CASE_CANDIDATE_SET_INVALID',
        },
      ],
    )
  }

  const publishedIds = []
  const outletIds =
    new Set()

  for (
    const snapshot of
    candidateSnapshots
  ) {
    const published =
      await publishPassportDocument({
        context,
        snapshot,
        actorUser,
        approvedByUserId:
          changeCase.approvedByUserId,
        reason:
          input.reason,
        evidence:
          input.evidence,
      })

    publishedIds.push(
      id(
        published._id,
      ),
    )

    outletIds.add(
      id(
        published.outletId,
      ),
    )
  }

  const greyBookIds = []

  for (
    const outletId of
    outletIds
  ) {
    const greyBook =
      await createGreyBookSnapshot({
        context,
        outletId,
        effectiveAt:
          new Date(),
        changeCaseId:
          changeCase._id,
        actorUser,
      })

    greyBookIds.push(
      greyBook._id,
    )
  }

  changeCase.status =
    'published'

  changeCase.publishedByUserId =
    actorId(
      actorUser,
    )

  changeCase.publishedAt =
    new Date()

  changeCase.generatedGreyBookSnapshotIds =
    greyBookIds

  changeCase.reason =
    input.reason

  changeCase.evidence =
    normalizeEvidence([
      ...(changeCase.evidence || []),
      ...input.evidence,
    ])

  await changeCase.save()

  return {
    changeCase:
      serializeChangeCase(
        changeCase,
      ),

    publishedPassportSnapshotIds:
      publishedIds,

    generatedGreyBookSnapshotIds:
      greyBookIds.map(id),

    policy: {
      previousPassportHistoryRetained:
        true,

      previousGreyBookHistoryRetained:
        true,

      automaticSourceMutation:
        false,
    },
  }
}