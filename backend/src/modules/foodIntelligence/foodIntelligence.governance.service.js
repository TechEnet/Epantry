import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  assertDistinctMakerCheckerActors,
} from '../admin/adminSafety.middleware.js'

import {
  CanonicalIngredient,
  EvidenceSource,
} from '../catalog/catalog.models.js'

import {
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  evaluateExplicitDietaryRule,
} from './foodIntelligence.engine.js'

import {
  normalizeFoodKey,
  normalizeJurisdictionCode,
} from './foodIntelligence.constants.js'

import {
  Allergen,
  FoodCalculation,
  IngredientRelation,
  RuleProfile,
} from './foodIntelligence.models.js'

import {
  nextFoodCalculationVersion,
} from './foodIntelligence.calculation.js'

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

function toPlain(
  value,
) {
  if (
    typeof value?.toObject ===
    'function'
  ) {
    return value.toObject()
  }

  return value
}

async function requireDocument({
  model,
  id,
  message,
  code,
}) {
  const document =
    await model.findById(
      id,
    )

  if (!document) {
    throw new ApiError(
      404,
      message,
      [
        {
          code,
        },
      ],
    )
  }

  return document
}

/*
|--------------------------------------------------------------------------
| Ingredient → Allergen Mapping
|--------------------------------------------------------------------------
*/

export async function createIngredientRelationDraft(
  input,
  actorUser,
) {
  await requireDocument({
    model:
      CanonicalIngredient,

    id:
      input.canonicalIngredientId,

    message:
      'Canonical Ingredient not found.',

    code:
      'FOOD_CANONICAL_INGREDIENT_NOT_FOUND',
  })

  await requireDocument({
    model:
      Allergen,

    id:
      input.allergenId,

    message:
      'Allergen not found.',

    code:
      'FOOD_ALLERGEN_NOT_FOUND',
  })

  await requireDocument({
    model:
      EvidenceSource,

    id:
      input.evidenceSourceId,

    message:
      'Evidence Source not found.',

    code:
      'FOOD_EVIDENCE_SOURCE_NOT_FOUND',
  })

  const latest =
    await IngredientRelation
      .findOne({
        canonicalIngredientId:
          input.canonicalIngredientId,

        allergenId:
          input.allergenId,

        relationType:
          input.relationType,
      })
      .sort({
        mappingVersion:
          -1,
      })
      .select(
        'mappingVersion',
      )
      .lean()

  const mappingVersion =
    Number(
      latest
        ?.mappingVersion ||
        0,
    ) +
    1

  const created =
    await IngredientRelation.create({
      canonicalIngredientId:
        input.canonicalIngredientId,

      allergenId:
        input.allergenId,

      relationType:
        input.relationType,

      mappingVersion,

      status:
        'draft',

      evidenceState:
        input.evidenceState,

      evidenceSourceId:
        input.evidenceSourceId,

      effectiveFrom:
        input.effectiveFrom,

      effectiveTo:
        input.effectiveTo,

      changeReason:
        input.changeReason,

      notes:
        input.notes,

      createdByUserId:
        stringId(
          actorUser,
        ),
    })

  return created.toObject()
}

export async function activateIngredientRelation(
  id,
  actorUser,
) {
  const relation =
    await requireDocument({
      model:
        IngredientRelation,

      id,

      message:
        'Ingredient allergen mapping not found.',

      code:
        'FOOD_INGREDIENT_RELATION_NOT_FOUND',
    })

  if (
    relation.status !==
    'draft'
  ) {
    throw new ApiError(
      409,
      'Only a draft Ingredient allergen mapping may be activated.',
      [
        {
          code:
            'FOOD_INGREDIENT_RELATION_NOT_DRAFT',
        },
      ],
    )
  }

  assertDistinctMakerCheckerActors({
    makerUserId:
      relation.createdByUserId,

    checkerUserId:
      stringId(
        actorUser,
      ),
  })

  const conflictingActive =
    await IngredientRelation
      .findOne({
        _id: {
          $ne:
            relation._id,
        },

        canonicalIngredientId:
          relation.canonicalIngredientId,

        allergenId:
          relation.allergenId,

        relationType:
          relation.relationType,

        status:
          'active',
      })
      .select(
        '_id',
      )
      .lean()

  if (
    conflictingActive
  ) {
    throw new ApiError(
      409,
      'An active mapping already exists. Retire it before activating the new version.',
      [
        {
          code:
            'FOOD_INGREDIENT_RELATION_ACTIVE_VERSION_EXISTS',
        },
      ],
    )
  }

  relation.status =
    'active'

  relation.approvedByUserId =
    stringId(
      actorUser,
    )

  relation.approvedAt =
    new Date()

  await relation.save()

  return relation.toObject()
}

export async function retireIngredientRelation(
  id,
  actorUser,
  reason,
) {
  const relation =
    await requireDocument({
      model:
        IngredientRelation,

      id,

      message:
        'Ingredient allergen mapping not found.',

      code:
        'FOOD_INGREDIENT_RELATION_NOT_FOUND',
    })

  if (
    relation.status ===
    'retired'
  ) {
    throw new ApiError(
      409,
      'Ingredient allergen mapping is already retired.',
      [
        {
          code:
            'FOOD_INGREDIENT_RELATION_ALREADY_RETIRED',
        },
      ],
    )
  }

  relation.status =
    'retired'

  relation.retiredAt =
    new Date()

  relation.notes =
    [
      relation.notes,

      `Retired: ${reason}`,

      `Actor: ${stringId(
        actorUser,
      )}`,
    ]
      .filter(
        Boolean,
      )
      .join(
        '\n',
      )

  await relation.save()

  return relation.toObject()
}

export async function listIngredientRelations(
  query,
) {
  const filter =
    {}

  if (
    query.canonicalIngredientId
  ) {
    filter.canonicalIngredientId =
      query.canonicalIngredientId
  }

  if (
    query.allergenId
  ) {
    filter.allergenId =
      query.allergenId
  }

  if (
    query.status
  ) {
    filter.status =
      query.status
  }

  const skip =
    (
      query.page -
      1
    ) *
    query.limit

  const [
    items,
    total,
  ] =
    await Promise.all([
      IngredientRelation
        .find(
          filter,
        )
        .sort({
          updatedAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          query.limit,
        )
        .lean(),

      IngredientRelation.countDocuments(
        filter,
      ),
    ])

  return {
    items,

    pagination: {
      page:
        query.page,

      limit:
        query.limit,

      total,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Food Rule Profiles
|--------------------------------------------------------------------------
*/

export async function createRuleProfileDraft(
  input,
  actorUser,
) {
  const ruleKey =
    normalizeFoodKey(
      input.ruleKey,
    )

  const jurisdictionCode =
    normalizeJurisdictionCode(
      input.jurisdictionCode,
    )

  if (
    input.evidenceSourceIds
      .length >
    0
  ) {
    const count =
      await EvidenceSource.countDocuments({
        _id: {
          $in:
            input.evidenceSourceIds,
        },
      })

    if (
      count !==
      new Set(
        input.evidenceSourceIds,
      ).size
    ) {
      throw new ApiError(
        400,
        'Unknown Evidence Source in Food Rule Profile.',
        [
          {
            code:
              'FOOD_RULE_EVIDENCE_SOURCE_NOT_FOUND',
          },
        ],
      )
    }
  }

  const latest =
    await RuleProfile
      .findOne({
        ruleKey,

        jurisdictionCode,
      })
      .sort({
        version:
          -1,
      })
      .select(
        'version',
      )
      .lean()

  const created =
    await RuleProfile.create({
      ruleKey,

      version:
        Number(
          latest
            ?.version ||
            0,
        ) +
        1,

      ruleType:
        input.ruleType,

      jurisdictionCode,

      status:
        'draft',

      definition:
        input.definition,

      evidenceSourceIds:
        input.evidenceSourceIds,

      effectiveFrom:
        input.effectiveFrom,

      effectiveTo:
        input.effectiveTo,

      changeReason:
        input.changeReason,

      createdByUserId:
        stringId(
          actorUser,
        ),
    })

  return created.toObject()
}

export async function activateRuleProfile(
  id,
  actorUser,
) {
  const profile =
    await requireDocument({
      model:
        RuleProfile,

      id,

      message:
        'Food Rule Profile not found.',

      code:
        'FOOD_RULE_PROFILE_NOT_FOUND',
    })

  if (
    profile.status !==
    'draft'
  ) {
    throw new ApiError(
      409,
      'Only a draft Food Rule Profile may be activated.',
      [
        {
          code:
            'FOOD_RULE_PROFILE_NOT_DRAFT',
        },
      ],
    )
  }

  assertDistinctMakerCheckerActors({
    makerUserId:
      profile.createdByUserId,

    checkerUserId:
      stringId(
        actorUser,
      ),
  })

  const active =
    await RuleProfile
      .findOne({
        _id: {
          $ne:
            profile._id,
        },

        ruleKey:
          profile.ruleKey,

        jurisdictionCode:
          profile.jurisdictionCode,

        status:
          'active',
      })
      .select(
        '_id',
      )
      .lean()

  if (
    active
  ) {
    throw new ApiError(
      409,
      'An active Food Rule Profile already exists. Retire it before activating the new version.',
      [
        {
          code:
            'FOOD_RULE_ACTIVE_VERSION_EXISTS',
        },
      ],
    )
  }

  profile.status =
    'active'

  profile.approvedByUserId =
    stringId(
      actorUser,
    )

  profile.approvedAt =
    new Date()

  await profile.save()

  return profile.toObject()
}

export async function retireRuleProfile(
  id,
) {
  const profile =
    await requireDocument({
      model:
        RuleProfile,

      id,

      message:
        'Food Rule Profile not found.',

      code:
        'FOOD_RULE_PROFILE_NOT_FOUND',
    })

  if (
    profile.status ===
    'retired'
  ) {
    throw new ApiError(
      409,
      'Food Rule Profile is already retired.',
      [
        {
          code:
            'FOOD_RULE_PROFILE_ALREADY_RETIRED',
        },
      ],
    )
  }

  profile.status =
    'retired'

  profile.retiredAt =
    new Date()

  await profile.save()

  return profile.toObject()
}

export async function listRuleProfiles(
  query,
) {
  const filter =
    {}

  if (
    query.ruleKey
  ) {
    filter.ruleKey =
      normalizeFoodKey(
        query.ruleKey,
      )
  }

  if (
    query.ruleType
  ) {
    filter.ruleType =
      query.ruleType
  }

  if (
    query.jurisdictionCode
  ) {
    filter.jurisdictionCode =
      normalizeJurisdictionCode(
        query.jurisdictionCode,
      )
  }

  if (
    query.status
  ) {
    filter.status =
      query.status
  }

  const skip =
    (
      query.page -
      1
    ) *
    query.limit

  const [
    items,
    total,
  ] =
    await Promise.all([
      RuleProfile
        .find(
          filter,
        )
        .sort({
          updatedAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          query.limit,
        )
        .lean(),

      RuleProfile.countDocuments(
        filter,
      ),
    ])

  return {
    items,

    pagination: {
      page:
        query.page,

      limit:
        query.limit,

      total,
    },
  }
}

export function testFoodRule(
  input,
) {
  return evaluateExplicitDietaryRule({
    ruleKey:
      input.ruleKey,

    requiredFacts:
      input.requiredFacts,

    factMap:
      input.factMap,

    evidenceComplete:
      input.evidenceComplete,
  })
}

/*
|--------------------------------------------------------------------------
| Food Calculation Review Queue
|--------------------------------------------------------------------------
*/

export async function listFoodCalculations(
  query,
) {
  const filter =
    {}

  if (
    query.entityType
  ) {
    filter.entityType =
      query.entityType
  }

  if (
    query.entityId
  ) {
    filter.entityId =
      query.entityId
  }

  if (
    query.status
  ) {
    filter.status =
      query.status
  }

  const skip =
    (
      query.page -
      1
    ) *
    query.limit

  const [
    items,
    total,
  ] =
    await Promise.all([
      FoodCalculation
        .find(
          filter,
        )
        .sort({
          generatedAt:
            -1,

          calculationVersion:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          query.limit,
        )
        .lean(),

      FoodCalculation.countDocuments(
        filter,
      ),
    ])

  return {
    items,

    pagination: {
      page:
        query.page,

      limit:
        query.limit,

      total,
    },
  }
}

export async function getFoodCalculation(
  id,
) {
  const calculation =
    await FoodCalculation
      .findById(
        id,
      )
      .lean()

  if (!calculation) {
    throw new ApiError(
      404,
      'Food Calculation not found.',
      [
        {
          code:
            'FOOD_CALCULATION_NOT_FOUND',
        },
      ],
    )
  }

  return calculation
}

export async function approveFoodCalculation(
  id,
  actorUser,
) {
  const source =
    await FoodCalculation
      .findById(
        id,
      )
      .lean()

  if (!source) {
    throw new ApiError(
      404,
      'Food Calculation not found.',
      [
        {
          code:
            'FOOD_CALCULATION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    ![
      'calculated',
      'requires_review',
    ].includes(
      source.status,
    )
  ) {
    throw new ApiError(
      409,
      'Only an unapproved Food Calculation may be approved.',
      [
        {
          code:
            'FOOD_CALCULATION_NOT_APPROVABLE',

          status:
            source.status,
        },
      ],
    )
  }

  if (
    source.entityType ===
      'recipe_version'
  ) {
    const recipeVersion =
      await RecipeVersion
        .findById(
          source.entityId,
        )
        .select(
          'submittedAt status',
        )
        .lean()

    if (
      recipeVersion
        ?.submittedAt &&
      source.generatedAt &&
      new Date(
        source.generatedAt,
      ).getTime() <
        new Date(
          recipeVersion.submittedAt,
        ).getTime()
    ) {
      throw new ApiError(
        409,
        'Recipe Food Intelligence was generated before the latest Recipe submission and must be refreshed.',
        [
          {
            code:
              'FOOD_RECIPE_CALCULATION_STALE',
          },
        ],
      )
    }
  }

  if (
    source.generatedByUserId
  ) {
    assertDistinctMakerCheckerActors({
      makerUserId:
        source.generatedByUserId,

      checkerUserId:
        stringId(
          actorUser,
        ),
    })
  }

  const existingApproval =
    await FoodCalculation
      .findOne({
        supersedesCalculationId:
          source._id,

        status:
          'approved',
      })
      .select(
        '_id',
      )
      .lean()

  if (
    existingApproval
  ) {
    throw new ApiError(
      409,
      'Food Calculation has already been approved.',
      [
        {
          code:
            'FOOD_CALCULATION_ALREADY_APPROVED',
        },
      ],
    )
  }

  const calculationVersion =
    await nextFoodCalculationVersion({
      entityType:
        source.entityType,

      entityId:
        source.entityId,
    })

  const approved =
    await FoodCalculation.create({
      entityType:
        source.entityType,

      entityId:
        source.entityId,

      calculationVersion,

      engineVersion:
        source.engineVersion,

      status:
        'approved',

      sourceVersions:
        source.sourceVersions,

      ruleProfileVersions:
        source.ruleProfileVersions,

      inputs:
        source.inputs,

      assumptions:
        source.assumptions,

      yieldFactors:
        source.yieldFactors,

      nutrients:
        source.nutrients,

      allergens:
        source.allergens,

      dietary:
        source.dietary,

      evidenceState:
        source.evidenceState,

      basis:
        source.basis,

      fingerprint:
        source.fingerprint,

      generatedAt:
        source.generatedAt,

      generatedByUserId:
        source.generatedByUserId,

      approvedByUserId:
        stringId(
          actorUser,
        ),

      approvedAt:
        new Date(),

      supersedesCalculationId:
        source._id,
    })

  return {
    source:
      toPlain(
        source,
      ),

    approved:
      approved.toObject(),
  }
}