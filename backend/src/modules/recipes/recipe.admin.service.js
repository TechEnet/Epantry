import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createRecipeImageUploadIntent,
} from '../../integrations/media/cloudinary.provider.js'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  FoodCalculation,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  normalizeRecipeKey,
  normalizeRecipeSlug,
} from './recipe.constants.js'

import {
  Dish,
  RecipeIngredient,
  RecipeStep,
  RecipeSubstitution,
  RecipeVersion,
} from './recipe.models.js'

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorId(
  actorUser,
) {
  const id =
    String(
      actorUser?._id ||
        actorUser?.id ||
        '',
    ).trim()

  if (!id) {
    throw new ApiError(
      401,
      'Authenticated administrative actor is required.',
      [
        {
          code:
            'RECIPE_ADMIN_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return id
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function normalizeTagList(
  values,
) {
  return [
    ...new Set(
      (
        values ||
        []
      )
        .map(
          normalizeRecipeKey,
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

function normalizeStringList(
  values,
) {
  return [
    ...new Set(
      (
        values ||
        []
      )
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

export function isEditableRecipeVersionStatus(
  status,
) {
  return status ===
    'draft'
}

export function assertRecipeVersionEditable(
  recipeVersion,
) {
  if (
    !recipeVersion ||
    !isEditableRecipeVersionStatus(
      recipeVersion.status,
    )
  ) {
    throw new ApiError(
      409,
      'Only draft Recipe Versions may be edited.',
      [
        {
          code:
            'RECIPE_VERSION_IMMUTABLE',
        },
      ],
    )
  }

  return true
}

export function serializeDish(
  dish,
) {
  const value =
    typeof dish?.toObject ===
      'function'
      ? dish.toObject()
      : dish

  if (!value) {
    return null
  }

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    name:
      value.name,

    slug:
      value.slug,

    description:
      value.description ||
      '',

    cuisine:
      value.cuisine ||
      '',

    course:
      value.course ||
      '',

    tags:
      value.tags ||
      [],

    language:
      value.language ||
      'en',

    heroImageUrl:
      value.heroImageUrl ||
      '',

    status:
      value.status,

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export function serializeRecipeVersion(
  recipeVersion,
) {
  const value =
    typeof recipeVersion?.toObject ===
      'function'
      ? recipeVersion.toObject()
      : recipeVersion

  if (!value) {
    return null
  }

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    dishId:
      stringifyId(
        value.dishId,
      ),

    versionNumber:
      value.versionNumber,

    title:
      value.title,

    description:
      value.description ||
      '',

    baseServings:
      value.baseServings,

    servingSizeAmount:
      value.servingSizeAmount ??
      null,

    servingSizeUnit:
      value.servingSizeUnit ||
      null,

    finishedYieldAmount:
      value.finishedYieldAmount ??
      null,

    finishedYieldUnit:
      value.finishedYieldUnit ||
      null,

    scalingMethod:
      value.scalingMethod,

    minRecommendedServings:
      value.minRecommendedServings ??
      null,

    maxRecommendedServings:
      value.maxRecommendedServings ??
      null,

    preparationTimeMinutes:
      value.preparationTimeMinutes ||
      0,

    cookingTimeMinutes:
      value.cookingTimeMinutes ||
      0,

    difficulty:
      value.difficulty,

    source: {
      type:
        value.sourceType,

      name:
        value.sourceName ||
        '',

      url:
        value.sourceUrl ||
        '',

      brandId:
        stringifyId(
          value.sourceBrandId,
        ),

      organizationId:
        stringifyId(
          value.sourceOrganizationId,
        ),
    },

    status:
      value.status,

    changeReason:
      value.changeReason ||
      '',

    unsafeIncomplete:
      value.unsafeIncomplete ===
      true,

    unsafeIncompleteReason:
      value.unsafeIncompleteReason ||
      '',

    effectiveFrom:
      value.effectiveFrom ||
      null,

    effectiveTo:
      value.effectiveTo ||
      null,

    submittedAt:
      value.submittedAt ||
      null,

    reviewedAt:
      value.reviewedAt ||
      null,

    publishedAt:
      value.publishedAt ||
      null,

    retiredAt:
      value.retiredAt ||
      null,

    disabledAt:
      value.disabledAt ||
      null,

    createdAt:
      value.createdAt ||
      null,

    updatedAt:
      value.updatedAt ||
      null,
  }
}

export function serializeRecipeIngredient(
  ingredient,
) {
  const value =
    typeof ingredient?.toObject ===
      'function'
      ? ingredient.toObject()
      : ingredient

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    lineNumber:
      value.lineNumber,

    canonicalIngredientId:
      stringifyId(
        value.canonicalIngredientId,
      ),

    quantity:
      value.quantity,

    unit:
      value.unit,

    preparationState:
      value.preparationState ||
      '',

    optional:
      value.optional ===
      true,

    role:
      value.role,

    notes:
      value.notes ||
      '',

    substitutionGroupKey:
      value.substitutionGroupKey ||
      '',

    productConstraints:
      value.productConstraints ||
      [],

    scalingRule:
      value.scalingRule || {
        type:
          'linear',

        exponent:
          1,

        minMultiplier:
          null,

        maxMultiplier:
          null,
      },
  }
}

export function serializeRecipeStep(
  step,
) {
  const value =
    typeof step?.toObject ===
      'function'
      ? step.toObject()
      : step

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    stepNumber:
      value.stepNumber,

    instruction:
      value.instruction,

    timerSeconds:
      value.timerSeconds ??
      null,

    temperature:
      value.temperatureValue ===
        null ||
      value.temperatureValue ===
        undefined
        ? null
        : {
            value:
              value.temperatureValue,

            unit:
              value.temperatureUnit,
          },

    equipment:
      value.equipment ||
      [],

    parallelizable:
      value.parallelizable ===
      true,

    prepAhead:
      value.prepAhead ===
      true,
  }
}

export function serializeRecipeSubstitution(
  substitution,
) {
  const value =
    typeof substitution?.toObject ===
      'function'
      ? substitution.toObject()
      : substitution

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    sourceRecipeIngredientId:
      stringifyId(
        value.sourceRecipeIngredientId,
      ),

    substituteCanonicalIngredientId:
      stringifyId(
        value.substituteCanonicalIngredientId,
      ),

    replacementRatio:
      value.replacementRatio,

    replacementUnit:
      value.replacementUnit ||
      null,

    priority:
      value.priority,

    notes:
      value.notes ||
      '',
  }
}

async function requireCanonicalIngredients(
  ingredientIds,
  session,
) {
  const normalizedIds =
    (
      Array.isArray(
        ingredientIds,
      )
        ? ingredientIds
        : []
    ).map(
      (
        value,
      ) =>
        String(
          value ??
            '',
        ).trim(),
    )

  const invalidIds =
    normalizedIds.filter(
      (
        value,
      ) =>
        !/^[a-f\d]{24}$/i.test(
          value,
        ),
    )

  if (invalidIds.length > 0) {
    throw new ApiError(
      400,
      'Every Recipe ingredient must resolve to a valid canonical Ingredient before persistence.',
      [
        {
          code:
            'RECIPE_CANONICAL_INGREDIENT_ID_INVALID',

          invalidCount:
            invalidIds.length,
        },
      ],
    )
  }

  const uniqueIds =
    [
      ...new Set(
        normalizedIds,
      ),
    ]

  const count =
    await CanonicalIngredient.countDocuments({
      _id: {
        $in:
          uniqueIds,
      },

      status: {
        $ne:
          'retired',
      },
    })
      .session(
        session,
      )

  if (
    count !==
    uniqueIds.length
  ) {
    throw new ApiError(
      400,
      'Every Recipe ingredient must reference an existing canonical Ingredient.',
      [
        {
          code:
            'RECIPE_CANONICAL_INGREDIENT_REQUIRED',
        },
      ],
    )
  }
}

function buildVersionValues({
  input,
  dishId,
  versionNumber,
  createdByUserId,
  changeReason = '',
}) {
  return {
    dishId,

    versionNumber,

    title:
      input.title,

    description:
      input.recipeDescription ||
      '',

    baseServings:
      input.baseServings,

    servingSizeAmount:
      input.servingSizeAmount,

    servingSizeUnit:
      input.servingSizeUnit,

    finishedYieldAmount:
      input.finishedYieldAmount,

    finishedYieldUnit:
      input.finishedYieldUnit,

    scalingMethod:
      input.scalingMethod,

    minRecommendedServings:
      input.minRecommendedServings,

    maxRecommendedServings:
      input.maxRecommendedServings,

    preparationTimeMinutes:
      input.preparationTimeMinutes,

    cookingTimeMinutes:
      input.cookingTimeMinutes,

    difficulty:
      input.difficulty,

    sourceType:
      input.source.type,

    sourceName:
      input.source.name,

    sourceUrl:
      input.source.url,

    sourceBrandId:
      input.source.brandId,

    sourceOrganizationId:
      input.source.organizationId,

    status:
      'draft',

    changeReason,

    unsafeIncomplete:
      input.unsafeIncomplete,

    unsafeIncompleteReason:
      input.unsafeIncompleteReason,

    createdByUserId,
  }
}

async function createRecipeChildren({
  recipeVersionId,
  ingredients,
  steps,
  substitutions,
  session,
}) {
  const ingredientDocuments =
    await RecipeIngredient.create(
      ingredients.map(
        (
          ingredient,
        ) => ({
          recipeVersionId,

          lineNumber:
            ingredient.lineNumber,

          canonicalIngredientId:
            ingredient.canonicalIngredientId,

          quantity:
            ingredient.quantity,

          unit:
            ingredient.unit,

          preparationState:
            ingredient.preparationState,

          optional:
            ingredient.optional,

          role:
            ingredient.role,

          notes:
            ingredient.notes,

          substitutionGroupKey:
            normalizeRecipeKey(
              ingredient.substitutionGroupKey,
            ),

          productConstraints:
            normalizeStringList(
              ingredient.productConstraints,
            ),

          scalingRule:
            ingredient.scalingRule,
        }),
      ),
      {
        session,

        ordered:
          true,
      },
    )

  const ingredientByLine =
    new Map(
      ingredientDocuments.map(
        (
          ingredient,
        ) => [
          ingredient.lineNumber,
          ingredient,
        ],
      ),
    )

  await RecipeStep.create(
    steps.map(
      (
        step,
      ) => ({
        recipeVersionId,

        stepNumber:
          step.stepNumber,

        instruction:
          step.instruction,

        timerSeconds:
          step.timerSeconds,

        temperatureValue:
          step.temperatureValue,

        temperatureUnit:
          step.temperatureUnit,

        equipment:
          normalizeStringList(
            step.equipment,
          ),

        parallelizable:
          step.parallelizable,

        prepAhead:
          step.prepAhead,
      }),
    ),
    {
      session,

      ordered:
        true,
    },
  )

  if (
    substitutions.length >
    0
  ) {
    await RecipeSubstitution.create(
      substitutions.map(
        (
          substitution,
        ) => {
          const sourceIngredient =
            ingredientByLine.get(
              substitution.sourceIngredientLineNumber,
            )

          if (
            !sourceIngredient
          ) {
            throw new ApiError(
              400,
              'Recipe substitution references an unknown ingredient line.',
              [
                {
                  code:
                    'RECIPE_SUBSTITUTION_SOURCE_INVALID',
                },
              ],
            )
          }

          return {
            recipeVersionId,

            sourceRecipeIngredientId:
              sourceIngredient._id,

            substituteCanonicalIngredientId:
              substitution.substituteCanonicalIngredientId,

            replacementRatio:
              substitution.replacementRatio,

            replacementUnit:
              substitution.replacementUnit,

            priority:
              substitution.priority,

            notes:
              substitution.notes,
          }
        },
      ),
      {
        session,

        ordered:
          true,
      },
    )
  }
}

async function loadRecipeAggregate(
  recipeVersionId,
  session = null,
) {
  const versionQuery =
    RecipeVersion.findById(
      recipeVersionId,
    )

  const ingredientQuery =
    RecipeIngredient.find({
      recipeVersionId,
    }).sort({
      lineNumber:
        1,
    })

  const stepQuery =
    RecipeStep.find({
      recipeVersionId,
    }).sort({
      stepNumber:
        1,
    })

  const substitutionQuery =
    RecipeSubstitution.find({
      recipeVersionId,
    }).sort({
      priority:
        1,

      _id:
        1,
    })

  if (session) {
    versionQuery.session(
      session,
    )

    ingredientQuery.session(
      session,
    )

    stepQuery.session(
      session,
    )

    substitutionQuery.session(
      session,
    )
  }

  const [
    version,
    ingredients,
    steps,
    substitutions,
  ] =
    await Promise.all([
      versionQuery.lean(),

      ingredientQuery.lean(),

      stepQuery.lean(),

      substitutionQuery.lean(),
    ])

  if (!version) {
    throw new ApiError(
      404,
      'Recipe Version was not found.',
      [
        {
          code:
            'RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const canonicalIngredientIds =
    [
      ...new Set(
        ingredients
          .map(
            (
              ingredient,
            ) =>
              stringifyId(
                ingredient.canonicalIngredientId,
              ),
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  let canonicalIngredients =
    []

  if (
    canonicalIngredientIds.length >
    0
  ) {
    const canonicalQuery =
      CanonicalIngredient.find({
        _id: {
          $in:
            canonicalIngredientIds,
        },
      })

    if (session) {
      canonicalQuery.session(
        session,
      )
    }

    canonicalIngredients =
      await canonicalQuery.lean()
  }

  const canonicalIngredientMap =
    new Map(
      canonicalIngredients.map(
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

  return {
    recipeVersion:
      serializeRecipeVersion(
        version,
      ),

    ingredients:
      ingredients.map(
        (
          ingredient,
        ) => {
          const serialized =
            serializeRecipeIngredient(
              ingredient,
            )

          const canonical =
            canonicalIngredientMap.get(
              serialized.canonicalIngredientId,
            )

          return {
            ...serialized,

            canonicalIngredient:
              canonical
                ? {
                    id:
                      stringifyId(
                        canonical._id,
                      ),

                    canonicalName:
                      canonical.canonicalName,

                    status:
                      canonical.status,

                    attributes:
                      canonical.attributes ||
                      {},
                  }
                : null,
          }
        },
      ),

    steps:
      steps.map(
        serializeRecipeStep,
      ),

    substitutions:
      substitutions.map(
        serializeRecipeSubstitution,
      ),
  }
}

export function createAdminRecipeImageUploadIntent(
  actorUser,
) {
  const userId =
    actorId(
      actorUser,
    )

  try {
    return createRecipeImageUploadIntent({
      userId,
    })
  } catch (error) {
    throw new ApiError(
      503,
      'Recipe image upload is temporarily unavailable.',
      [
        {
          code:
            error?.code ||
            'RECIPE_IMAGE_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }
}

export async function updateAdminRecipeHeroImage(
  dishId,
  heroImageUrl,
  actorUser,
) {
  actorId(
    actorUser,
  )

  const dish =
    await Dish.findById(
      dishId,
    )

  if (!dish) {
    throw new ApiError(
      404,
      'Dish was not found.',
      [
        {
          code:
            'RECIPE_DISH_NOT_FOUND',
        },
      ],
    )
  }

  const previousHeroImageUrl =
    dish.heroImageUrl ||
    ''

  dish.heroImageUrl =
    heroImageUrl ||
    ''

  await dish.save()

  return {
    dish:
      serializeDish(
        dish,
      ),

    previousHeroImageUrl,
  }
}

export async function createAdminRecipe(
  input,
  actorUser,
) {
  const createdByUserId =
    actorId(
      actorUser,
    )

  const slug =
    normalizeRecipeSlug(
      input.slug ||
      input.name,
    )

  if (!slug) {
    throw new ApiError(
      400,
      'A valid Dish slug is required.',
      [
        {
          code:
            'RECIPE_DISH_SLUG_INVALID',
        },
      ],
    )
  }

  const session =
    await mongoose.startSession()

  let dishId =
    null

  let recipeVersionId =
    null

  try {
    await session.withTransaction(
      async () => {
        const duplicate =
          await Dish.exists({
            slug,
          }).session(
            session,
          )

        if (duplicate) {
          throw new ApiError(
            409,
            'A Dish with this slug already exists.',
            [
              {
                code:
                  'RECIPE_DISH_SLUG_CONFLICT',
              },
            ],
          )
        }

        await requireCanonicalIngredients(
          [
            ...input.ingredients.map(
              (
                ingredient,
              ) =>
                ingredient.canonicalIngredientId,
            ),

            ...input.substitutions.map(
              (
                substitution,
              ) =>
                substitution.substituteCanonicalIngredientId,
            ),
          ],
          session,
        )

        const [
          dish,
        ] =
          await Dish.create(
            [
              {
                name:
                  input.name,

                slug,

                description:
                  input.description,

                cuisine:
                  input.cuisine,

                course:
                  input.course,

                tags:
                  normalizeTagList(
                    input.tags,
                  ),

                language:
                  input.language
                    .trim()
                    .toLowerCase(),

                heroImageUrl:
                  input.heroImageUrl,

                status:
                  'active',

                nextRecipeVersionNumber:
                  2,

                createdByUserId,
              },
            ],
            {
              session,
            },
          )

        dishId =
          dish._id

        const [
          version,
        ] =
          await RecipeVersion.create(
            [
              buildVersionValues({
                input,

                dishId:
                  dish._id,

                versionNumber:
                  1,

                createdByUserId,
              }),
            ],
            {
              session,
            },
          )

        recipeVersionId =
          version._id

        await createRecipeChildren({
          recipeVersionId:
            version._id,

          ingredients:
            input.ingredients,

          steps:
            input.steps,

          substitutions:
            input.substitutions,

          session,
        })
      },
    )
  } finally {
    await session.endSession()
  }

  const [
    dish,
    recipe,
  ] =
    await Promise.all([
      Dish.findById(
        dishId,
      ).lean(),

      loadRecipeAggregate(
        recipeVersionId,
      ),
    ])

  return {
    dish:
      serializeDish(
        dish,
      ),

    ...recipe,
  }
}

export async function getAdminRecipeVersion(
  recipeVersionId,
) {
  const recipe =
    await loadRecipeAggregate(
      recipeVersionId,
    )

  const dish =
    await Dish.findById(
      recipe.recipeVersion.dishId,
    ).lean()

  if (!dish) {
    throw new ApiError(
      404,
      'Dish was not found.',
      [
        {
          code:
            'RECIPE_DISH_NOT_FOUND',
        },
      ],
    )
  }

  return {
    dish:
      serializeDish(
        dish,
      ),

    ...recipe,
  }
}

export async function updateAdminRecipeDraft(
  recipeVersionId,
  input,
  actorUser,
) {
  actorId(
    actorUser,
  )

  const session =
    await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const version =
          await RecipeVersion.findById(
            recipeVersionId,
          ).session(
            session,
          )

        assertRecipeVersionEditable(
          version,
        )

        await requireCanonicalIngredients(
          [
            ...input.ingredients.map(
              (
                ingredient,
              ) =>
                ingredient.canonicalIngredientId,
            ),

            ...input.substitutions.map(
              (
                substitution,
              ) =>
                substitution.substituteCanonicalIngredientId,
            ),
          ],
          session,
        )

        Object.assign(
          version,
          buildVersionValues({
            input,

            dishId:
              version.dishId,

            versionNumber:
              version.versionNumber,

            createdByUserId:
              version.createdByUserId,

            changeReason:
              version.changeReason,
          }),
        )

        await version.save({
          session,
        })

        await Promise.all([
          RecipeSubstitution.deleteMany({
            recipeVersionId:
              version._id,
          }).session(
            session,
          ),

          RecipeStep.deleteMany({
            recipeVersionId:
              version._id,
          }).session(
            session,
          ),
        ])

        await RecipeIngredient.deleteMany({
          recipeVersionId:
            version._id,
        }).session(
          session,
        )

        await createRecipeChildren({
          recipeVersionId:
            version._id,

          ingredients:
            input.ingredients,

          steps:
            input.steps,

          substitutions:
            input.substitutions,

          session,
        })
      },
    )
  } finally {
    await session.endSession()
  }

  return getAdminRecipeVersion(
    recipeVersionId,
  )
}

export async function createNextAdminRecipeVersion(
  dishId,
  input,
  actorUser,
) {
  const createdByUserId =
    actorId(
      actorUser,
    )

  const session =
    await mongoose.startSession()

  let createdVersionId =
    null

  try {
    await session.withTransaction(
      async () => {
        const dish =
          await Dish.findOneAndUpdate(
            {
              _id:
                dishId,

              status:
                'active',
            },
            {
              $inc: {
                nextRecipeVersionNumber:
                  1,
              },
            },
            {
              new:
                false,

              session,
            },
          )

        if (!dish) {
          throw new ApiError(
            404,
            'Active Dish was not found.',
            [
              {
                code:
                  'RECIPE_DISH_NOT_FOUND',
              },
            ],
          )
        }

        const versionNumber =
          dish.nextRecipeVersionNumber

        let sourceVersion =
          null

        if (
          input.sourceRecipeVersionId
        ) {
          sourceVersion =
            await RecipeVersion.findOne({
              _id:
                input.sourceRecipeVersionId,

              dishId:
                dish._id,
            }).session(
              session,
            )
        } else {
          sourceVersion =
            await RecipeVersion.findOne({
              dishId:
                dish._id,

              status: {
                $in: [
                  'published',
                  'retired',
                  'disabled',
                ],
              },
            })
              .sort({
                versionNumber:
                  -1,
              })
              .session(
                session,
              )
        }

        if (!sourceVersion) {
          throw new ApiError(
            409,
            'A governed source Recipe Version is required before creating the next version.',
            [
              {
                code:
                  'RECIPE_SOURCE_VERSION_REQUIRED',
              },
            ],
          )
        }

        const [
          sourceIngredients,
          sourceSteps,
          sourceSubstitutions,
        ] =
          await Promise.all([
            RecipeIngredient.find({
              recipeVersionId:
                sourceVersion._id,
            })
              .sort({
                lineNumber:
                  1,
              })
              .session(
                session,
              )
              .lean(),

            RecipeStep.find({
              recipeVersionId:
                sourceVersion._id,
            })
              .sort({
                stepNumber:
                  1,
              })
              .session(
                session,
              )
              .lean(),

            RecipeSubstitution.find({
              recipeVersionId:
                sourceVersion._id,
            })
              .sort({
                priority:
                  1,
              })
              .session(
                session,
              )
              .lean(),
          ])

        const [
          version,
        ] =
          await RecipeVersion.create(
            [
              {
                dishId:
                  dish._id,

                versionNumber,

                title:
                  sourceVersion.title,

                description:
                  sourceVersion.description,

                baseServings:
                  sourceVersion.baseServings,

                servingSizeAmount:
                  sourceVersion.servingSizeAmount,

                servingSizeUnit:
                  sourceVersion.servingSizeUnit,

                finishedYieldAmount:
                  sourceVersion.finishedYieldAmount,

                finishedYieldUnit:
                  sourceVersion.finishedYieldUnit,

                scalingMethod:
                  sourceVersion.scalingMethod,

                minRecommendedServings:
                  sourceVersion.minRecommendedServings,

                maxRecommendedServings:
                  sourceVersion.maxRecommendedServings,

                preparationTimeMinutes:
                  sourceVersion.preparationTimeMinutes,

                cookingTimeMinutes:
                  sourceVersion.cookingTimeMinutes,

                difficulty:
                  sourceVersion.difficulty,

                sourceType:
                  sourceVersion.sourceType,

                sourceName:
                  sourceVersion.sourceName,

                sourceUrl:
                  sourceVersion.sourceUrl,

                sourceBrandId:
                  sourceVersion.sourceBrandId,

                sourceOrganizationId:
                  sourceVersion.sourceOrganizationId,

                status:
                  'draft',

                changeReason:
                  input.changeReason,

                unsafeIncomplete:
                  sourceVersion.unsafeIncomplete,

                unsafeIncompleteReason:
                  sourceVersion.unsafeIncompleteReason,

                createdByUserId,
              },
            ],
            {
              session,
            },
          )

        createdVersionId =
          version._id

        const copiedIngredients =
          await RecipeIngredient.create(
            sourceIngredients.map(
              (
                ingredient,
              ) => ({
                recipeVersionId:
                  version._id,

                lineNumber:
                  ingredient.lineNumber,

                canonicalIngredientId:
                  ingredient.canonicalIngredientId,

                quantity:
                  ingredient.quantity,

                unit:
                  ingredient.unit,

                preparationState:
                  ingredient.preparationState,

                optional:
                  ingredient.optional,

                role:
                  ingredient.role,

                notes:
                  ingredient.notes,

                substitutionGroupKey:
                  ingredient.substitutionGroupKey,

                productConstraints:
                  ingredient.productConstraints,

                scalingRule:
                  ingredient.scalingRule,
              }),
            ),
            {
              session,

              ordered:
                true,
            },
          )

        await RecipeStep.create(
          sourceSteps.map(
            (
              step,
            ) => ({
              recipeVersionId:
                version._id,

              stepNumber:
                step.stepNumber,

              instruction:
                step.instruction,

              timerSeconds:
                step.timerSeconds,

              temperatureValue:
                step.temperatureValue,

              temperatureUnit:
                step.temperatureUnit,

              equipment:
                step.equipment,

              parallelizable:
                step.parallelizable,

              prepAhead:
                step.prepAhead,
            }),
          ),
          {
            session,

            ordered:
              true,
          },
        )

        const copiedIngredientBySourceId =
          new Map(
            copiedIngredients.map(
              (
                copiedIngredient,
              ) => [
                String(
                  sourceIngredients.find(
                    (
                      sourceIngredient,
                    ) =>
                      sourceIngredient.lineNumber ===
                      copiedIngredient.lineNumber,
                  )?._id,
                ),

                copiedIngredient,
              ],
            ),
          )

        if (
          sourceSubstitutions.length >
          0
        ) {
          await RecipeSubstitution.create(
            sourceSubstitutions.map(
              (
                substitution,
              ) => {
                const copiedSourceIngredient =
                  copiedIngredientBySourceId.get(
                    String(
                      substitution.sourceRecipeIngredientId,
                    ),
                  )

                if (
                  !copiedSourceIngredient
                ) {
                  throw new ApiError(
                    409,
                    'Recipe substitution lineage could not be cloned safely.',
                    [
                      {
                        code:
                          'RECIPE_SUBSTITUTION_CLONE_FAILED',
                      },
                    ],
                  )
                }

                return {
                  recipeVersionId:
                    version._id,

                  sourceRecipeIngredientId:
                    copiedSourceIngredient._id,

                  substituteCanonicalIngredientId:
                    substitution.substituteCanonicalIngredientId,

                  replacementRatio:
                    substitution.replacementRatio,

                  replacementUnit:
                    substitution.replacementUnit,

                  priority:
                    substitution.priority,

                  notes:
                    substitution.notes,
                }
              },
            ),
            {
              session,

              ordered:
                true,
            },
          )
        }
      },
    )
  } finally {
    await session.endSession()
  }

  return getAdminRecipeVersion(
    createdVersionId,
  )
}

export async function listAdminRecipes({
  page,
  limit,
  status,
  search,
}) {
  const filter =
    {}

  if (
    status !==
    'all'
  ) {
    filter.status =
      status
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        'i',
      )

    filter.$or = [
      {
        name:
          expression,
      },

      {
        slug:
          expression,
      },

      {
        cuisine:
          expression,
      },

      {
        course:
          expression,
      },
    ]
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    dishes,
    total,
  ] =
    await Promise.all([
      Dish.find(
        filter,
      )
        .sort({
          updatedAt:
            -1,

          _id:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      Dish.countDocuments(
        filter,
      ),
    ])

  const latestVersions =
    await Promise.all(
      dishes.map(
        async (
          dish,
        ) =>
          RecipeVersion.findOne({
            dishId:
              dish._id,
          })
            .sort({
              versionNumber:
                -1,
            })
            .lean(),
      ),
    )

  const latestVersionIds =
    latestVersions
      .map(
        (
          version,
        ) =>
          version?._id,
      )
      .filter(
        Boolean,
      )

  const foodCalculations =
    latestVersionIds.length >
      0
      ? await FoodCalculation.find({
          entityType:
            'recipe_version',

          entityId: {
            $in:
              latestVersionIds,
          },
        })
          .sort({
            calculationVersion:
              -1,
          })
          .select(
            'entityId status calculationVersion generatedAt approvedAt',
          )
          .lean()
      : []

  const latestFoodCalculationByVersion =
    new Map()

  const latestApprovedFoodCalculationByVersion =
    new Map()

  for (
    const calculation
    of foodCalculations
  ) {
    const key =
      stringifyId(
        calculation.entityId,
      )

    if (
      !latestFoodCalculationByVersion.has(
        key,
      )
    ) {
      latestFoodCalculationByVersion.set(
        key,
        calculation,
      )
    }

    if (
      calculation.status ===
        'approved' &&
      !latestApprovedFoodCalculationByVersion.has(
        key,
      )
    ) {
      latestApprovedFoodCalculationByVersion.set(
        key,
        calculation,
      )
    }
  }

  return {
    recipes:
      dishes.map(
        (
          dish,
          index,
        ) => {
          const version =
            latestVersions[
              index
            ]

          const versionId =
            stringifyId(
              version?._id,
            )

          const latestFoodCalculation =
            latestFoodCalculationByVersion.get(
              versionId,
            ) ||
            null

          const latestApprovedFoodCalculation =
            latestApprovedFoodCalculationByVersion.get(
              versionId,
            ) ||
            null

          return {
            dish:
              serializeDish(
                dish,
              ),

            latestVersion:
              serializeRecipeVersion(
                version,
              ),

            foodIntelligence: {
              status:
                latestFoodCalculation
                  ?.status ||
                'missing',

              approved:
                Boolean(
                  latestApprovedFoodCalculation,
                ),

              latestCalculationVersion:
                latestFoodCalculation
                  ?.calculationVersion ||
                null,

              generatedAt:
                latestFoodCalculation
                  ?.generatedAt ||
                null,

              approvedAt:
                latestApprovedFoodCalculation
                  ?.approvedAt ||
                null,
            },
          }
        },
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  }
}
