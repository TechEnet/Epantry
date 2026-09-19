import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  PantryItem,
} from '../pantry/pantry.models.js'

import {
  reconcileRecipeRequirementsWithPantry,
} from '../pantry/pantry.reconciliation.js'

import {
  requireCurrentPantryHousehold,
  serializePantryItem,
} from '../pantry/pantry.service.js'

import {
  Dish,
  RecipeIngredient,
  RecipeSubstitution,
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  scaleRecipeAggregate,
} from '../recipes/recipe.scaling.js'

import {
  buildOutcomePlanProjection,
  consolidateOutcomeRequirements,
} from './outcomePlan.engine.js'

import {
  OutcomePlan,
  RequirementDecision,
  RequirementLine,
  SubstitutionPolicy,
} from './outcomePlan.models.js'

const OBJECT_ID_PATTERN =
  /^[a-f\d]{24}$/i

const MUTATION_KEY_LIMIT =
  100

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

function normalizeCanonicalIngredientIds(
  values = [],
) {
  return [
    ...new Set(
      (Array.isArray(
        values,
      )
        ? values
        : [])
        .map(
          stringifyId,
        )
        .filter(
          (value) =>
            value &&
            OBJECT_ID_PATTERN.test(
              value,
            ),
        ),
    ),
  ]
}

function normalizePurchaseMode(
  value,
) {
  return value ===
    'full_recipe'
    ? 'full_recipe'
    : 'missing_only'
}

function actorIdFromUser(
  actorUser,
) {
  const actorUserId =
    actorUser?._id ||
    actorUser?.id

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'OUTCOME_PLAN_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return actorUserId
}

function asPlainObject(
  value,
) {
  if (
    !value
  ) {
    return null
  }

  if (
    typeof value.toObject ===
    'function'
  ) {
    return value.toObject()
  }

  return value
}

function trimMutationKeys(
  keys = [],
) {
  return [
    ...new Set(
      keys
        .map(
          (
            key,
          ) =>
            String(
              key ||
                '',
            ).trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ].slice(
    -MUTATION_KEY_LIMIT,
  )
}

/*
|--------------------------------------------------------------------------
| Recipe Context
|--------------------------------------------------------------------------
|
| Creation uses current published M07 Recipe Version.
| Recalculation reuses the original immutable Recipe Version.
|
*/

async function loadRecipeRelations(
  recipeVersion,
) {
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
    ingredients,
    substitutions,
  }
}

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
            String(
              recipeId,
            )
              .trim()
              .toLowerCase(),
        }

  const dish =
    await Dish
      .findOne({
        ...dishFilter,

        status:
          'active',
      })
      .lean()

  if (
    !dish
  ) {
    throw new ApiError(
      404,
      'Published Recipe was not found.',
      [
        {
          code:
            'OUTCOME_PLAN_RECIPE_NOT_FOUND',
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
        versionNumber:
          -1,

        publishedAt:
          -1,
      })
      .lean()

  if (
    !recipeVersion
  ) {
    throw new ApiError(
      404,
      'Published Recipe Version was not found.',
      [
        {
          code:
            'OUTCOME_PLAN_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const relations =
    await loadRecipeRelations(
      recipeVersion,
    )

  return {
    dish,
    recipeVersion,
    ...relations,
  }
}

async function requireRecipeVersionContext(
  recipeVersionId,
) {
  const recipeVersion =
    await RecipeVersion
      .findById(
        recipeVersionId,
      )
      .lean()

  if (
    !recipeVersion
  ) {
    throw new ApiError(
      409,
      'Outcome Plan source Recipe Version is no longer available.',
      [
        {
          code:
            'OUTCOME_PLAN_SOURCE_RECIPE_VERSION_MISSING',
        },
      ],
    )
  }

  const dish =
    await Dish
      .findById(
        recipeVersion.dishId,
      )
      .lean()

  if (
    !dish
  ) {
    throw new ApiError(
      409,
      'Outcome Plan source Recipe is no longer available.',
      [
        {
          code:
            'OUTCOME_PLAN_SOURCE_RECIPE_MISSING',
        },
      ],
    )
  }

  const relations =
    await loadRecipeRelations(
      recipeVersion,
    )

  return {
    dish,
    recipeVersion,
    ...relations,
  }
}

async function buildScaledRequirements({
  recipeContext,
  targetServings,
  selectedCanonicalIngredientIds =
    [],
}) {
  const scaled =
    scaleRecipeAggregate({
      recipeVersion:
        recipeContext
          .recipeVersion,

      ingredients:
        recipeContext
          .ingredients,

      substitutions:
        recipeContext
          .substitutions,

      targetServings,
    })

  const scaledRows =
    scaled?.ingredients ||
    scaled?.scaledIngredients ||
    scaled?.requirements ||
    []

  const ingredientById =
    new Map(
      recipeContext
        .ingredients
        .map(
          (
            ingredient,
          ) => [
            stringifyId(
              ingredient._id,
            ),
            ingredient,
          ],
        ),
    )

  const canonicalIds =
    [
      ...new Set(
        recipeContext
          .ingredients
          .map(
            (
              ingredient,
            ) =>
              stringifyId(
                ingredient
                  .canonicalIngredientId,
              ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  const ingredientNames =
    canonicalIds.length ===
    0
      ? []
      : await CanonicalIngredient
          .find({
            _id: {
              $in:
                canonicalIds,
            },
          })
          .select({
            canonicalName:
              1,
          })
          .lean()

  const nameById =
    new Map(
      ingredientNames.map(
        (
          ingredient,
        ) => [
          stringifyId(
            ingredient._id,
          ),
          ingredient.canonicalName,
        ],
      ),
    )

  const normalized =
    scaledRows.map(
      (
        row,
      ) => {
        const recipeIngredientId =
          stringifyId(
            row.ingredientId ||
            row.recipeIngredientId ||
            row._id ||
            row.id,
          )

        const original =
          ingredientById.get(
            recipeIngredientId,
          ) ||
          null

        const canonicalIngredientId =
          stringifyId(
            row.canonicalIngredientId ||
            original
              ?.canonicalIngredientId,
          )

        return {
          recipeIngredientId,

          canonicalIngredientId,

          requiredQuantity:
            row.scaledQuantity ??
            row.quantity ??
            row.requirementQuantity,

          requiredUnit:
            row.scaledUnit ||
            row.unit ||
            row.requirementUnit,

          optional:
            row.optional ===
              true ||
            original?.optional ===
              true,

          label:
            nameById.get(
              canonicalIngredientId,
            ) ||
            '',

          substitutionGroupKey:
            original
              ?.substitutionGroupKey ||
            '',

          productConstraints:
            original
              ?.productConstraints ||
            [],
        }
      },
    )

  const selectedIds =
    normalizeCanonicalIngredientIds(
      selectedCanonicalIngredientIds,
    )

  const selectedSet =
    new Set(
      selectedIds,
    )

  const scopedNormalized =
    selectedSet.size >
    0
      ? normalized.filter(
          (requirement) =>
            selectedSet.has(
              requirement
                .canonicalIngredientId,
            ),
        )
      : normalized

  if (
    selectedSet.size >
    0
  ) {
    const matchedIds =
      new Set(
        scopedNormalized
          .map(
            (requirement) =>
              requirement
                .canonicalIngredientId,
          )
          .filter(
            Boolean,
          ),
      )

    const missingSelection =
      selectedIds.find(
        (ingredientId) =>
          !matchedIds.has(
            ingredientId,
          ),
      )

    if (
      missingSelection
    ) {
      throw new ApiError(
        400,
        'Selected ingredient does not belong to this published Recipe Version.',
        [
          {
            code:
              'OUTCOME_PLAN_RECIPE_INGREDIENT_SCOPE_INVALID',
          },
        ],
      )
    }
  }

  return {
    scalingWarnings:
      scaled?.warnings ||
      [],

    requirements:
      consolidateOutcomeRequirements(
        scopedNormalized,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Pantry Reconciliation
|--------------------------------------------------------------------------
*/

async function loadPantryForRequirements({
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
              requirement
                .canonicalIngredientId,
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

async function calculateOutcomeSnapshot({
  recipeContext,
  targetServings,
  householdId,
  optionalIncludedIdentityKeys =
    [],
  purchaseMode =
    'missing_only',
  selectedCanonicalIngredientIds =
    [],
}) {
  const {
    scalingWarnings,
    requirements,
  } =
    await buildScaledRequirements({
      recipeContext,
      targetServings,
      selectedCanonicalIngredientIds,
    })

  const normalizedPurchaseMode =
    normalizePurchaseMode(
      purchaseMode,
    )

  const pantryItems =
    normalizedPurchaseMode ===
    'full_recipe'
      ? []
      : await loadPantryForRequirements({
          householdId,
          requirements,
        })

  const reconciliation =
    reconcileRecipeRequirementsWithPantry({
      requirements:
        requirements.map(
          (
            requirement,
          ) => ({
            recipeIngredientId:
              requirement
                .sourceRecipeIngredientIds[0] ||
              null,

            canonicalIngredientId:
              requirement
                .canonicalIngredientId,

            quantity:
              requirement
                .requiredQuantity,

            unit:
              requirement
                .requiredUnit,

            optional:
              requirement.optional,

            label:
              requirement.label,
          }),
        ),

      pantryItems,
    })

  const projection =
    buildOutcomePlanProjection({
      requirements,

      reconciliationLines:
        reconciliation.lines,

      pantryItems,

      optionalIncludedIdentityKeys:
        normalizedPurchaseMode ===
        'full_recipe'
          ? requirements
              .filter(
                (requirement) =>
                  requirement.optional ===
                  true,
              )
              .map(
                (requirement) =>
                  requirement.identityKey,
              )
          : optionalIncludedIdentityKeys,
    })

  return {
    ...projection,

    scalingWarnings,

    requirements,
  }
}

function buildSubstitutionPolicies({
  outcomePlanId,
  revision,
  requirements,
  substitutions,
}) {
  const identityByRecipeIngredientId =
    new Map()

  for (
    const requirement
    of requirements
  ) {
    for (
      const sourceId
      of requirement
        .sourceRecipeIngredientIds
    ) {
      identityByRecipeIngredientId.set(
        sourceId,
        requirement.identityKey,
      )
    }
  }

  return substitutions
    .map(
      (
        substitution,
      ) => {
        const sourceId =
          stringifyId(
            substitution
              .sourceRecipeIngredientId,
          )

        const requirementIdentityKey =
          identityByRecipeIngredientId.get(
            sourceId,
          )

        if (
          !requirementIdentityKey
        ) {
          return null
        }

        return {
          outcomePlanId,

          revision,

          requirementIdentityKey,

          sourceRecipeIngredientId:
            substitution
              .sourceRecipeIngredientId,

          substituteCanonicalIngredientId:
            substitution
              .substituteCanonicalIngredientId,

          replacementRatio:
            substitution
              .replacementRatio,

          replacementUnit:
            substitution
              .replacementUnit ||
            null,

          priority:
            substitution
              .priority ||
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
}

function toRequirementLineDocuments({
  outcomePlanId,
  revision,
  lines,
}) {
  return lines.map(
    (
      line,
    ) => ({
      outcomePlanId,

      revision,

      ...line,
    }),
  )
}

/*
|--------------------------------------------------------------------------
| Serialization
|--------------------------------------------------------------------------
*/

function serializeRequirementLine(
  rawLine,
) {
  const line =
    asPlainObject(
      rawLine,
    )

  return {
    id:
      stringifyId(
        line._id,
      ),

    identityKey:
      line.identityKey,

    sourceRecipeIngredientIds:
      (
        line.sourceRecipeIngredientIds ||
        []
      ).map(
        stringifyId,
      ),

    canonicalIngredientId:
      stringifyId(
        line.canonicalIngredientId,
      ),

    label:
      line.label ||
      '',

    requiredQuantity:
      line.requiredQuantity,

    requiredUnit:
      line.requiredUnit,

    usablePantryQuantity:
      line.usablePantryQuantity ??
      null,

    pantryState:
      line.pantryState ||
      null,

    pantryReconciliationState:
      line.pantryReconciliationState,

    pantryReason:
      line.pantryReason ||
      '',

    genuineShortage:
      line.genuineShortage ??
      null,

    shortageUnit:
      line.shortageUnit ||
      null,

    shortageState:
      line.shortageState,

    group:
      line.group,

    optional:
      line.optional ===
      true,

    includedInBasket:
      line.includedInBasket ===
      true,

    purchaseRequired:
      line.purchaseRequired ===
      true,

    needsConfirmation:
      line.needsConfirmation ===
      true,

    substitutionGroupKey:
      line.substitutionGroupKey ||
      '',

    productConstraints:
      line.productConstraints ||
      [],
  }
}

function summarizeStoredLines(
  lines,
) {
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

  return summary
}

async function serializeStoredOutcomePlan(
  rawPlan,
) {
  const plan =
    asPlainObject(
      rawPlan,
    )

  const [
    rawLines,
    rawPolicies,
  ] =
    await Promise.all([
      RequirementLine
        .find({
          outcomePlanId:
            plan._id,

          revision:
            plan.revision,
        })
        .sort({
          _id:
            1,
        })
        .lean(),

      SubstitutionPolicy
        .find({
          outcomePlanId:
            plan._id,

          revision:
            plan.revision,
        })
        .sort({
          priority:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  const lines =
    rawLines.map(
      serializeRequirementLine,
    )

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
          requirementLineId:
            line.id,

          canonicalIngredientId:
            line.canonicalIngredientId,

          label:
            line.label,

          quantity:
            line.genuineShortage,

          unit:
            line.shortageUnit,

          optional:
            line.optional,

          substitutionGroupKey:
            line.substitutionGroupKey,

          productConstraints:
            line.productConstraints,
        }),
      )

  return {
    plan: {
      id:
        stringifyId(
          plan._id,
        ),

      sourceType:
        plan.sourceType,

      sourceDishId:
        stringifyId(
          plan.sourceDishId,
        ),

      sourceRecipeVersionId:
        stringifyId(
          plan.sourceRecipeVersionId,
        ),

      sourceRecipeSlug:
        plan.sourceRecipeSlug,

      sourceRecipeTitle:
        plan.sourceRecipeTitle,

      targetServings:
        plan.targetServings,

      purchaseMode:
        normalizePurchaseMode(
          plan.purchaseMode,
        ),

      selectedCanonicalIngredientIds:
        normalizeCanonicalIngredientIds(
          plan.selectedCanonicalIngredientIds,
        ),

      revision:
        plan.revision,

      readinessState:
        plan.readinessState,

      status:
        plan.status,

      lastRecalculatedAt:
        plan.lastRecalculatedAt,

      createdAt:
        plan.createdAt,

      updatedAt:
        plan.updatedAt,
    },

    requirements:
      lines,

    summary:
      summarizeStoredLines(
        lines,
      ),

    requirementBasket:
      basket,

    // Neutral M11 handoff only.
    // No Product, Offer, price, inventory or serviceability selection here.
    productMatchingInput:
      basket.map(
        (
          line,
        ) => ({
          requirementLineId:
            line.requirementLineId,

          canonicalIngredientId:
            line.canonicalIngredientId,

          quantity:
            line.quantity,

          unit:
            line.unit,

          productConstraints:
            line.productConstraints,

          substitutionGroupKey:
            line.substitutionGroupKey,
        }),
      ),

    substitutionPolicies:
      rawPolicies.map(
        (
          policy,
        ) => ({
          id:
            stringifyId(
              policy._id,
            ),

          requirementIdentityKey:
            policy.requirementIdentityKey,

          sourceRecipeIngredientId:
            stringifyId(
              policy.sourceRecipeIngredientId,
            ),

          substituteCanonicalIngredientId:
            stringifyId(
              policy.substituteCanonicalIngredientId,
            ),

          replacementRatio:
            policy.replacementRatio,

          replacementUnit:
            policy.replacementUnit ||
            null,

          priority:
            policy.priority,

          notes:
            policy.notes ||
            '',
        }),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Ownership
|--------------------------------------------------------------------------
*/

async function requireOwnedOutcomePlan({
  planId,
  actorUser,
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const plan =
    await OutcomePlan
      .findOne({
        _id:
          planId,

        ownerUserId,

        householdId,

        status:
          'active',
      })

  if (
    !plan
  ) {
    throw new ApiError(
      404,
      'Outcome Plan was not found.',
      [
        {
          code:
            'OUTCOME_PLAN_NOT_FOUND',
        },
      ],
    )
  }

  return {
    plan,

    ownerUserId,

    householdId,
  }
}

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export async function createRecipeOutcomePlan({
  recipeId,
  targetServings,
  purchaseMode =
    'missing_only',
  selectedCanonicalIngredientIds =
    [],
  idempotencyKey,
  actorUser,
  now =
    new Date(),
}) {
  const ownerUserId =
    actorIdFromUser(
      actorUser,
    )

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const normalizedPurchaseMode =
    normalizePurchaseMode(
      purchaseMode,
    )

  const normalizedSelectedIngredientIds =
    normalizeCanonicalIngredientIds(
      selectedCanonicalIngredientIds,
    )

  const existing =
    await OutcomePlan
      .findOne({
        ownerUserId,

        createIdempotencyKey:
          idempotencyKey,
      })
      .lean()

  if (
    existing
  ) {
    return serializeStoredOutcomePlan(
      existing,
    )
  }

  const recipeContext =
    await requirePublishedRecipe(
      recipeId,
      now,
    )

  const snapshot =
    await calculateOutcomeSnapshot({
      recipeContext,

      targetServings,

      householdId,

      purchaseMode:
        normalizedPurchaseMode,

      selectedCanonicalIngredientIds:
        normalizedSelectedIngredientIds,
    })

  const session =
    await mongoose.startSession()

  try {
    let createdPlan =
      null

    await session.withTransaction(
      async () => {
        const [
          plan,
        ] =
          await OutcomePlan.create(
            [
              {
                ownerUserId,

                householdId,

                sourceType:
                  'recipe',

                sourceDishId:
                  recipeContext.dish._id,

                sourceRecipeVersionId:
                  recipeContext.recipeVersion._id,

                sourceRecipeSlug:
                  recipeContext.dish.slug,

                sourceRecipeTitle:
                  recipeContext.dish.name ||
                  recipeContext.recipeVersion.title,

                targetServings,

                purchaseMode:
                  normalizedPurchaseMode,

                selectedCanonicalIngredientIds:
                  normalizedSelectedIngredientIds,

                revision:
                  1,

                readinessState:
                  snapshot.readinessState,

                status:
                  'active',

                createIdempotencyKey:
                  idempotencyKey,

                appliedMutationKeys:
                  [],

                lastRecalculatedAt:
                  now,
              },
            ],
            {
              session,
            },
          )

        createdPlan =
          plan

        const requirementDocuments =
          toRequirementLineDocuments({
            outcomePlanId:
              plan._id,

            revision:
              1,

            lines:
              snapshot.lines,
          })

        if (
          requirementDocuments.length >
          0
        ) {
          await RequirementLine.insertMany(
            requirementDocuments,
            {
              session,
            },
          )
        }

        const policies =
          buildSubstitutionPolicies({
            outcomePlanId:
              plan._id,

            revision:
              1,

            requirements:
              snapshot.requirements,

            substitutions:
              recipeContext.substitutions,
          })

        if (
          policies.length >
          0
        ) {
          await SubstitutionPolicy.insertMany(
            policies,
            {
              session,
            },
          )
        }
      },
    )

    return serializeStoredOutcomePlan(
      createdPlan,
    )
  } catch (
    error
  ) {
    if (
      error?.code ===
      11000
    ) {
      const duplicate =
        await OutcomePlan
          .findOne({
            ownerUserId,

            createIdempotencyKey:
              idempotencyKey,
          })
          .lean()

      if (
        duplicate
      ) {
        return serializeStoredOutcomePlan(
          duplicate,
        )
      }
    }

    throw error
  } finally {
    await session.endSession()
  }
}

/*
|--------------------------------------------------------------------------
| Read
|--------------------------------------------------------------------------
*/

export async function getOutcomePlan({
  planId,
  actorUser,
}) {
  const {
    plan,
  } =
    await requireOwnedOutcomePlan({
      planId,

      actorUser,
    })

  return serializeStoredOutcomePlan(
    plan,
  )
}

/*
|--------------------------------------------------------------------------
| Recalculate / Requirement Decisions
|--------------------------------------------------------------------------
*/

export async function updateOutcomePlanRequirements({
  planId,
  targetServings,
  decisions = [],
  idempotencyKey,
  actorUser,
  now =
    new Date(),
}) {
  const {
    plan,
    ownerUserId,
    householdId,
  } =
    await requireOwnedOutcomePlan({
      planId,

      actorUser,
    })

  if (
    plan.appliedMutationKeys.includes(
      idempotencyKey,
    )
  ) {
    return serializeStoredOutcomePlan(
      plan,
    )
  }

  const currentLines =
    await RequirementLine
      .find({
        outcomePlanId:
          plan._id,

        revision:
          plan.revision,
      })
      .lean()

  const lineById =
    new Map(
      currentLines.map(
        (
          line,
        ) => [
          stringifyId(
            line._id,
          ),

          line,
        ],
      ),
    )

  const optionalIncluded =
    new Set(
      currentLines
        .filter(
          (
            line,
          ) =>
            line.optional &&
            line.includedInBasket,
        )
        .map(
          (
            line,
          ) =>
            line.identityKey,
        ),
    )

  for (
    const decision
    of decisions
  ) {
    const line =
      lineById.get(
        decision.requirementLineId,
      )

    if (
      !line ||
      line.optional !==
        true
    ) {
      throw new ApiError(
        400,
        'Optional requirement decision does not belong to the current Outcome Plan revision.',
        [
          {
            code:
              'OUTCOME_PLAN_OPTIONAL_DECISION_INVALID',
          },
        ],
      )
    }

    if (
      decision.action ===
      'include_optional'
    ) {
      optionalIncluded.add(
        line.identityKey,
      )
    } else {
      optionalIncluded.delete(
        line.identityKey,
      )
    }
  }

  const nextTargetServings =
    targetServings ??
    plan.targetServings

  const servingChanged =
    nextTargetServings !==
    plan.targetServings

  if (
    !servingChanged &&
    decisions.length ===
    0
  ) {
    throw new ApiError(
      400,
      'Outcome Plan update requires an actual serving or optional requirement change.',
      [
        {
          code:
            'OUTCOME_PLAN_NO_CHANGE',
        },
      ],
    )
  }

  const recipeContext =
    await requireRecipeVersionContext(
      plan.sourceRecipeVersionId,
    )

  const snapshot =
    await calculateOutcomeSnapshot({
      recipeContext,

      targetServings:
        nextTargetServings,

      householdId,

      optionalIncludedIdentityKeys:
        [
          ...optionalIncluded,
        ],

      purchaseMode:
        plan.purchaseMode ||
        'missing_only',

      selectedCanonicalIngredientIds:
        plan.selectedCanonicalIngredientIds ||
        [],
    })

  const nextRevision =
    plan.revision +
    1

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const requirementDocuments =
          toRequirementLineDocuments({
            outcomePlanId:
              plan._id,

            revision:
              nextRevision,

            lines:
              snapshot.lines,
          })

        if (
          requirementDocuments.length >
          0
        ) {
          await RequirementLine.insertMany(
            requirementDocuments,
            {
              session,
            },
          )
        }

        const policies =
          buildSubstitutionPolicies({
            outcomePlanId:
              plan._id,

            revision:
              nextRevision,

            requirements:
              snapshot.requirements,

            substitutions:
              recipeContext.substitutions,
          })

        if (
          policies.length >
          0
        ) {
          await SubstitutionPolicy.insertMany(
            policies,
            {
              session,
            },
          )
        }

        const decisionDocuments =
          []

        if (
          servingChanged
        ) {
          decisionDocuments.push({
            outcomePlanId:
              plan._id,

            revision:
              nextRevision,

            requirementIdentityKey:
              null,

            action:
              'servings_changed',

            previousTargetServings:
              plan.targetServings,

            nextTargetServings,

            actorUserId:
              ownerUserId,

            mutationKey:
              idempotencyKey,

            decidedAt:
              now,
          })
        }

        decisions.forEach(
          (
            decision,
          ) => {
            const currentLine =
              lineById.get(
                decision.requirementLineId,
              )

            decisionDocuments.push({
              outcomePlanId:
                plan._id,

              revision:
                nextRevision,

              requirementIdentityKey:
                currentLine.identityKey,

              action:
                decision.action,

              actorUserId:
                ownerUserId,

              mutationKey:
                idempotencyKey,

              decidedAt:
                now,
            })
          },
        )

        if (
          decisionDocuments.length >
          0
        ) {
          await RequirementDecision.insertMany(
            decisionDocuments,
            {
              session,
            },
          )
        }

        plan.targetServings =
          nextTargetServings

        plan.revision =
          nextRevision

        plan.readinessState =
          snapshot.readinessState

        plan.lastRecalculatedAt =
          now

        plan.appliedMutationKeys =
          trimMutationKeys([
            ...plan
              .appliedMutationKeys,

            idempotencyKey,
          ])

        await plan.save({
          session,
        })
      },
    )

    return serializeStoredOutcomePlan(
      plan,
    )
  } finally {
    await session.endSession()
  }
}