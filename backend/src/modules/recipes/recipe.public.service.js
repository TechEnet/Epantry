import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createOpenRouterChatCompletion,
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from '../../integrations/ai/ai.provider.js'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

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

import {
  scaleRecipeAggregate,
} from './recipe.scaling.js'

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

function currentPublishedFilter(
  now =
    new Date(),
) {
  return {
    status:
      'published',

    effectiveFrom: {
      $lte:
        now,
    },

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
  }
}

export function serializePublicDish(
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
  }
}

export function serializePublicRecipeVersion(
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
    },

    publishedAt:
      value.publishedAt ||
      null,

    effectiveFrom:
      value.effectiveFrom ||
      null,
  }
}

function serializePublicIngredientIdentity(
  ingredient,
) {
  if (!ingredient) {
    return null
  }

  return {
    id:
      stringifyId(
        ingredient._id ||
          ingredient.id,
      ),

    name:
      ingredient.name ||
      ingredient.displayName ||
      ingredient.canonicalName ||
      'Ingredient',

    slug:
      ingredient.slug ||
      '',
  }
}

function serializePublicRecipeIngredient(
  ingredient,
  canonicalIngredient,
) {
  return {
    id:
      stringifyId(
        ingredient._id ||
          ingredient.id,
      ),

    lineNumber:
      ingredient.lineNumber,

    ingredient:
      serializePublicIngredientIdentity(
        canonicalIngredient,
      ),

    quantity:
      ingredient.quantity,

    unit:
      ingredient.unit,

    preparationState:
      ingredient.preparationState ||
      '',

    optional:
      ingredient.optional ===
      true,

    role:
      ingredient.role,

    notes:
      ingredient.notes ||
      '',

    substitutionGroupKey:
      ingredient.substitutionGroupKey ||
      '',
  }
}

function serializePublicRecipeStep(
  step,
) {
  return {
    id:
      stringifyId(
        step._id ||
          step.id,
      ),

    stepNumber:
      step.stepNumber,

    instruction:
      step.instruction,

    timerSeconds:
      step.timerSeconds ??
      null,

    temperature:
      step.temperatureValue ===
        null ||
      step.temperatureValue ===
        undefined
        ? null
        : {
            value:
              step.temperatureValue,

            unit:
              step.temperatureUnit,
          },

    equipment:
      step.equipment ||
      [],

    parallelizable:
      step.parallelizable ===
      true,

    prepAhead:
      step.prepAhead ===
      true,
  }
}

function serializePublicRecipeSubstitution(
  substitution,
  canonicalIngredient,
) {
  return {
    id:
      stringifyId(
        substitution._id ||
          substitution.id,
      ),

    sourceRecipeIngredientId:
      stringifyId(
        substitution.sourceRecipeIngredientId,
      ),

    substituteIngredient:
      serializePublicIngredientIdentity(
        canonicalIngredient,
      ),

    replacementRatio:
      substitution.replacementRatio,

    replacementUnit:
      substitution.replacementUnit ||
      null,

    priority:
      substitution.priority,

    notes:
      substitution.notes ||
      '',
  }
}

async function loadCanonicalIngredientMap(
  ingredientIds,
) {
  const uniqueIds =
    [
      ...new Set(
        ingredientIds
          .map(
            stringifyId,
          )
          .filter(
            Boolean,
          ),
      ),
    ]

  if (
    uniqueIds.length ===
    0
  ) {
    return new Map()
  }

  const ingredients =
    await CanonicalIngredient.find({
      _id: {
        $in:
          uniqueIds,
      },
    }).lean()

  return new Map(
    ingredients.map(
      (
        ingredient,
      ) => [
        String(
          ingredient._id,
        ),

        ingredient,
      ],
    ),
  )
}

async function loadPublicRecipeChildren(
  recipeVersionId,
) {
  const [
    ingredients,
    steps,
    substitutions,
  ] =
    await Promise.all([
      RecipeIngredient.find({
        recipeVersionId,
      })
        .sort({
          lineNumber:
            1,
        })
        .lean(),

      RecipeStep.find({
        recipeVersionId,
      })
        .sort({
          stepNumber:
            1,
        })
        .lean(),

      RecipeSubstitution.find({
        recipeVersionId,
      })
        .sort({
          priority:
            1,

          _id:
            1,
        })
        .lean(),
    ])

  const canonicalIngredientMap =
    await loadCanonicalIngredientMap([
      ...ingredients.map(
        (
          ingredient,
        ) =>
          ingredient.canonicalIngredientId,
      ),

      ...substitutions.map(
        (
          substitution,
        ) =>
          substitution.substituteCanonicalIngredientId,
      ),
    ])

  return {
    ingredients:
      ingredients.map(
        (
          ingredient,
        ) =>
          serializePublicRecipeIngredient(
            ingredient,

            canonicalIngredientMap.get(
              String(
                ingredient.canonicalIngredientId,
              ),
            ),
          ),
      ),

    rawIngredients:
      ingredients,

    steps:
      steps.map(
        serializePublicRecipeStep,
      ),

    substitutions:
      substitutions.map(
        (
          substitution,
        ) =>
          serializePublicRecipeSubstitution(
            substitution,

            canonicalIngredientMap.get(
              String(
                substitution.substituteCanonicalIngredientId,
              ),
            ),
          ),
      ),

    rawSubstitutions:
      substitutions,
  }
}

async function findCurrentPublishedRecipeVersion(
  dishId,
) {
  return RecipeVersion.findOne({
    dishId,

    ...currentPublishedFilter(),
  })
    .sort({
      versionNumber:
        -1,
    })
    .lean()
}

function serializePublicRecipeCard({
  dish,
  recipeVersion,
}) {
  return {
    dish:
      serializePublicDish(
        dish,
      ),

    recipe:
      serializePublicRecipeVersion(
        recipeVersion,
      ),

    path:
      `/recipes/${dish.slug}`,
  }
}

/*
|--------------------------------------------------------------------------
| Public Browse
|--------------------------------------------------------------------------
*/

export async function listPublicRecipes({
  page,
  limit,
  search,
  cuisine,
  course,
  tag,
}) {
  const now =
    new Date()

  const publishedVersions =
    await RecipeVersion.find(
      currentPublishedFilter(
        now,
      ),
    )
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  const versionByDishId =
    new Map()

  for (
    const version of
    publishedVersions
  ) {
    const dishKey =
      String(
        version.dishId,
      )

    if (
      !versionByDishId.has(
        dishKey,
      )
    ) {
      versionByDishId.set(
        dishKey,
        version,
      )
    }
  }

  const dishIds =
    [
      ...versionByDishId.keys(),
    ]

  if (
    dishIds.length ===
    0
  ) {
    return {
      recipes:
        [],

      pagination: {
        page,

        limit,

        total:
          0,

        pages:
          0,
      },
    }
  }

  const filter = {
    _id: {
      $in:
        dishIds,
    },

    status:
      'active',
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
        description:
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

      {
        tags:
          expression,
      },
    ]
  }

  if (cuisine) {
    filter.cuisine =
      new RegExp(
        `^${escapeRegex(
          cuisine,
        )}$`,
        'i',
      )
  }

  if (course) {
    filter.course =
      new RegExp(
        `^${escapeRegex(
          course,
        )}$`,
        'i',
      )
  }

  if (tag) {
    filter.tags =
      normalizeRecipeKey(
        tag,
      )
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
          name:
            1,

          _id:
            1,
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

  return {
    recipes:
      dishes
        .map(
          (
            dish,
          ) => {
            const recipeVersion =
              versionByDishId.get(
                String(
                  dish._id,
                ),
              )

            if (
              !recipeVersion
            ) {
              return null
            }

            return serializePublicRecipeCard({
              dish,

              recipeVersion,
            })
          },
        )
        .filter(
          Boolean,
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

/*
|--------------------------------------------------------------------------
| Public Detail
|--------------------------------------------------------------------------
*/

export async function getPublicRecipe(
  slug,
) {
  const normalizedSlug =
    normalizeRecipeSlug(
      slug,
    )

  const dish =
    await Dish.findOne({
      slug:
        normalizedSlug,

      status:
        'active',
    }).lean()

  if (!dish) {
    throw new ApiError(
      404,
      'Recipe was not found.',
      [
        {
          code:
            'PUBLIC_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  const recipeVersion =
    await findCurrentPublishedRecipeVersion(
      dish._id,
    )

  if (
    !recipeVersion
  ) {
    throw new ApiError(
      404,
      'Published Recipe was not found.',
      [
        {
          code:
            'PUBLIC_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const children =
    await loadPublicRecipeChildren(
      recipeVersion._id,
    )

  return {
    dish:
      serializePublicDish(
        dish,
      ),

    recipe:
      serializePublicRecipeVersion(
        recipeVersion,
      ),

    ingredients:
      children.ingredients,

    steps:
      children.steps,

    substitutions:
      children.substitutions,
  }
}

/*
|--------------------------------------------------------------------------
| Public Version History
|--------------------------------------------------------------------------
*/

export async function getPublicRecipeHistory(
  slug,
  {
    limit,
  },
) {
  const normalizedSlug =
    normalizeRecipeSlug(
      slug,
    )

  const dish =
    await Dish.findOne({
      slug:
        normalizedSlug,

      status:
        'active',
    }).lean()

  if (!dish) {
    throw new ApiError(
      404,
      'Recipe was not found.',
      [
        {
          code:
            'PUBLIC_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  const versions =
    await RecipeVersion.find({
      dishId:
        dish._id,

      status: {
        $in: [
          'published',
          'retired',
        ],
      },
    })
      .sort({
        versionNumber:
          -1,
      })
      .limit(
        limit,
      )
      .lean()

  return {
    dish:
      serializePublicDish(
        dish,
      ),

    versions:
      versions.map(
        (
          version,
        ) => ({
          id:
            stringifyId(
              version._id,
            ),

          versionNumber:
            version.versionNumber,

          title:
            version.title,

          status:
            version.status,

          changeReason:
            version.changeReason ||
            '',

          publishedAt:
            version.publishedAt ||
            null,

          effectiveFrom:
            version.effectiveFrom ||
            null,

          effectiveTo:
            version.effectiveTo ||
            null,

          retiredAt:
            version.retiredAt ||
            null,
        }),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Public Deterministic Scaling
|--------------------------------------------------------------------------
*/

export async function scalePublicRecipe(
  slug,
  targetServings,
) {
  const normalizedSlug =
    normalizeRecipeSlug(
      slug,
    )

  const dish =
    await Dish.findOne({
      slug:
        normalizedSlug,

      status:
        'active',
    }).lean()

  if (!dish) {
    throw new ApiError(
      404,
      'Recipe was not found.',
      [
        {
          code:
            'PUBLIC_RECIPE_NOT_FOUND',
        },
      ],
    )
  }

  const recipeVersion =
    await findCurrentPublishedRecipeVersion(
      dish._id,
    )

  if (
    !recipeVersion
  ) {
    throw new ApiError(
      404,
      'Published Recipe was not found.',
      [
        {
          code:
            'PUBLIC_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const children =
    await loadPublicRecipeChildren(
      recipeVersion._id,
    )

  const scaled =
    scaleRecipeAggregate({
      recipeVersion,

      ingredients:
        children.rawIngredients,

      substitutions:
        children.rawSubstitutions,

      targetServings,
    })

  const canonicalIngredientMap =
    await loadCanonicalIngredientMap([
      ...children.rawIngredients.map(
        (
          ingredient,
        ) =>
          ingredient.canonicalIngredientId,
      ),

      ...children.rawSubstitutions.map(
        (
          substitution,
        ) =>
          substitution.substituteCanonicalIngredientId,
      ),
    ])

  return {
    dish:
      serializePublicDish(
        dish,
      ),

    recipe:
      serializePublicRecipeVersion(
        recipeVersion,
      ),

    scaling: {
      ...scaled,

      ingredients:
        scaled.ingredients.map(
          (
            ingredient,
          ) => ({
            ...ingredient,

            ingredient:
              serializePublicIngredientIdentity(
                canonicalIngredientMap.get(
                  String(
                    ingredient.canonicalIngredientId,
                  ),
                ),
              ),
          }),
        ),

      substitutions:
        scaled.substitutions.map(
          (
            substitution,
          ) => ({
            ...substitution,

            substituteIngredient:
              serializePublicIngredientIdentity(
                canonicalIngredientMap.get(
                  String(
                    substitution.substituteCanonicalIngredientId,
                  ),
                ),
              ),
          }),
        ),
    },
  }
}

/*
|--------------------------------------------------------------------------
| What Should We Cook
|--------------------------------------------------------------------------
|
| This is intentionally basic deterministic pantry coverage.
|
| It makes no nutrition, allergen, dietary, health or safety conclusion.
|--------------------------------------------------------------------------
*/

export function rankRecipeCandidatesByPantry({
  candidates,
  availableIngredientIds,
  limit =
    12,
}) {
  const available =
    new Set(
      availableIngredientIds.map(
        String,
      ),
    )

  return candidates
    .map(
      (
        candidate,
      ) => {
        const requiredIngredientIds =
          [
            ...new Set(
              (
                candidate.ingredientRows ||
                []
              )
                .filter(
                  (
                    row,
                  ) =>
                    row.optional !==
                    true,
                )
                .map(
                  (
                    row,
                  ) =>
                    String(
                      row.canonicalIngredientId,
                    ),
                ),
            ),
          ]

        const matchedIngredientIds =
          requiredIngredientIds.filter(
            (
              ingredientId,
            ) =>
              available.has(
                ingredientId,
              ),
          )

        const missingIngredientIds =
          requiredIngredientIds.filter(
            (
              ingredientId,
            ) =>
              !available.has(
                ingredientId,
              ),
          )

        const coverageRatio =
          requiredIngredientIds.length ===
          0
            ? 0
            : matchedIngredientIds.length /
              requiredIngredientIds.length

        return {
          ...candidate,

          matching: {
            requiredIngredientCount:
              requiredIngredientIds.length,

            matchedIngredientCount:
              matchedIngredientIds.length,

            missingIngredientCount:
              missingIngredientIds.length,

            matchedIngredientIds,

            missingIngredientIds,

            coverageRatio:
              Number(
                coverageRatio.toFixed(
                  6,
                ),
              ),
          },
        }
      },
    )
    .filter(
      (
        candidate,
      ) =>
        candidate.matching
          .matchedIngredientCount >
        0,
    )
    .sort(
      (
        left,
        right,
      ) => {
        if (
          right.matching
            .coverageRatio !==
          left.matching
            .coverageRatio
        ) {
          return (
            right.matching
              .coverageRatio -
            left.matching
              .coverageRatio
          )
        }

        if (
          left.matching
            .missingIngredientCount !==
          right.matching
            .missingIngredientCount
        ) {
          return (
            left.matching
              .missingIngredientCount -
            right.matching
              .missingIngredientCount
          )
        }

        return String(
          left.dish?.name ||
            '',
        ).localeCompare(
          String(
            right.dish?.name ||
              '',
          ),
        )
      },
    )
    .slice(
      0,
      limit,
    )
}


function cleanAiText(
  value,
  maxLength =
    600,
) {
  return String(
    value ||
      '',
  )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .slice(
      0,
      maxLength,
    )
}

function cleanAiStringList(
  value,
  limit =
    12,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return []
  }

  return value
    .map((item) =>
      cleanAiText(
        item,
        160,
      ),
    )
    .filter(
      Boolean,
    )
    .slice(
      0,
      limit,
    )
}

function extractAiContentText(
  content,
) {
  if (
    typeof content ===
      'string'
  ) {
    return content
  }

  if (
    Array.isArray(
      content,
    )
  ) {
    return content
      .map((part) => {
        if (
          typeof part ===
            'string'
        ) {
          return part
        }

        if (
          !part ||
          typeof part !==
            'object'
        ) {
          return ''
        }

        if (
          typeof part.text ===
            'string'
        ) {
          return part.text
        }

        if (
          typeof part.content ===
            'string'
        ) {
          return part.content
        }

        if (
          typeof part.output_text ===
            'string'
        ) {
          return part.output_text
        }

        return ''
      })
      .filter(
        Boolean,
      )
      .join(
        '\n',
      )
  }

  if (
    content &&
    typeof content ===
      'object'
  ) {
    if (
      typeof content.text ===
        'string'
    ) {
      return content.text
    }

    if (
      typeof content.content ===
        'string'
    ) {
      return content.content
    }

    if (
      typeof content.output_text ===
        'string'
    ) {
      return content.output_text
    }
  }

  return ''
}

function normalizeAiJsonText(
  value,
) {
  return String(
    value ||
      '',
  )
    .replace(
      /^\uFEFF/,
      '',
    )
    .replace(
      /[\u201C\u201D]/g,
      '"',
    )
    .replace(
      /[\u2018\u2019]/g,
      "'",
    )
    .replace(
      /^```(?:json|javascript|js)?\s*/i,
      '',
    )
    .replace(
      /\s*```$/,
      '',
    )
    .trim()
}

function extractFirstBalancedJsonObject(
  value,
) {
  const text =
    String(
      value ||
        '',
    )

  const start =
    text.indexOf(
      '{',
    )

  if (
    start <
      0
  ) {
    return ''
  }

  let depth =
    0

  let inString =
    false

  let escaped =
    false

  for (
    let index =
      start;
    index <
      text.length;
    index +=
      1
  ) {
    const char =
      text[index]

    if (
      inString
    ) {
      if (
        escaped
      ) {
        escaped =
          false

        continue
      }

      if (
        char ===
          '\\'
      ) {
        escaped =
          true

        continue
      }

      if (
        char ===
          '"'
      ) {
        inString =
          false
      }

      continue
    }

    if (
      char ===
        '"'
    ) {
      inString =
        true

      continue
    }

    if (
      char ===
        '{'
    ) {
      depth +=
        1

      continue
    }

    if (
      char ===
        '}'
    ) {
      depth -=
        1

      if (
        depth ===
          0
      ) {
        return text.slice(
          start,
          index +
            1,
        )
      }
    }
  }

  return ''
}

function escapeJsonStringControlCharacters(
  value,
) {
  const text =
    String(
      value ||
        '',
    )

  let result =
    ''

  let inString =
    false

  let escaped =
    false

  for (
    const char of
    text
  ) {
    if (
      inString
    ) {
      if (
        escaped
      ) {
        result +=
          char

        escaped =
          false

        continue
      }

      if (
        char ===
          '\\'
      ) {
        result +=
          char

        escaped =
          true

        continue
      }

      if (
        char ===
          '"'
      ) {
        result +=
          char

        inString =
          false

        continue
      }

      if (
        char ===
          '\n'
      ) {
        result +=
          '\\n'

        continue
      }

      if (
        char ===
          '\r'
      ) {
        result +=
          '\\r'

        continue
      }

      if (
        char ===
          '\t'
      ) {
        result +=
          '\\t'

        continue
      }

      result +=
        char

      continue
    }

    result +=
      char

    if (
      char ===
        '"'
    ) {
      inString =
        true
    }
  }

  return result
}

function convertSingleQuotedJsonStrings(
  value,
) {
  const text =
    String(
      value ||
        '',
    )

  let result =
    ''

  let quote =
    null

  let escaped =
    false

  for (
    let index =
      0;
    index <
      text.length;
    index +=
      1
  ) {
    const char =
      text[index]

    if (
      quote ===
        '"'
    ) {
      result +=
        char

      if (
        escaped
      ) {
        escaped =
          false

        continue
      }

      if (
        char ===
          '\\'
      ) {
        escaped =
          true
      } else if (
        char ===
          '"'
      ) {
        quote =
          null
      }

      continue
    }

    if (
      quote ===
        "'"
    ) {
      if (
        escaped
      ) {
        if (
          char ===
            "'"
        ) {
          result +=
            "'"
        } else {
          result +=
            `\\${char}`
        }

        escaped =
          false

        continue
      }

      if (
        char ===
          '\\'
      ) {
        escaped =
          true

        continue
      }

      if (
        char ===
          "'"
      ) {
        result +=
          '"'

        quote =
          null

        continue
      }

      if (
        char ===
          '"'
      ) {
        result +=
          '\\"'

        continue
      }

      result +=
        char

      continue
    }

    if (
      char ===
        '"'
    ) {
      quote =
        '"'

      result +=
        char

      continue
    }

    if (
      char ===
        "'"
    ) {
      quote =
        "'"

      result +=
        '"'

      continue
    }

    result +=
      char
  }

  if (
    quote ===
      "'"
  ) {
    result +=
      '"'
  }

  return result
}

function repairCommonAiJson(
  value,
) {
  return escapeJsonStringControlCharacters(
    convertSingleQuotedJsonStrings(
      value,
    ),
  )
    .replace(
      /,\s*([}\]])/g,
      '$1',
    )
    .replace(
      /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g,
      '$1"$2":',
    )
}

function closeTruncatedAiJson(
  value,
) {
  let text =
    repairCommonAiJson(
      value,
    ).trim()

  const start =
    text.indexOf(
      '{',
    )

  if (
    start <
      0
  ) {
    return ''
  }

  text =
    text.slice(
      start,
    )

  const stack =
    []

  let inString =
    false

  let escaped =
    false

  for (
    const char of
    text
  ) {
    if (
      inString
    ) {
      if (
        escaped
      ) {
        escaped =
          false

        continue
      }

      if (
        char ===
          '\\'
      ) {
        escaped =
          true

        continue
      }

      if (
        char ===
          '"'
      ) {
        inString =
          false
      }

      continue
    }

    if (
      char ===
        '"'
    ) {
      inString =
        true

      continue
    }

    if (
      char ===
        '{' ||
      char ===
        '['
    ) {
      stack.push(
        char,
      )

      continue
    }

    if (
      char ===
        '}' ||
      char ===
        ']'
    ) {
      const expected =
        char ===
          '}'
          ? '{'
          : '['

      if (
        stack[
          stack.length -
            1
        ] ===
          expected
      ) {
        stack.pop()
      }
    }
  }

  if (
    inString
  ) {
    text +=
      '"'
  }

  text =
    text.replace(
      /,\s*$/,
      '',
    )

  while (
    stack.length >
      0
  ) {
    const open =
      stack.pop()

    text +=
      open ===
        '{'
        ? '}'
        : ']'
  }

  return text.replace(
    /,\s*([}\]])/g,
    '$1',
  )
}

function tryParseAiJson(
  value,
) {
  const candidates =
    []

  const normalized =
    normalizeAiJsonText(
      value,
    )

  const balanced =
    extractFirstBalancedJsonObject(
      normalized,
    )

  const firstBrace =
    normalized.indexOf(
      '{',
    )

  const jsonLike =
    firstBrace >=
      0
      ? normalized.slice(
          firstBrace,
        )
      : normalized

  candidates.push(
    balanced,
    jsonLike,
    repairCommonAiJson(
      balanced ||
        jsonLike,
    ),
    closeTruncatedAiJson(
      balanced ||
        jsonLike,
    ),
  )

  for (
    const candidate of
    candidates
  ) {
    if (
      !candidate
    ) {
      continue
    }

    try {
      const parsed =
        JSON.parse(
          candidate,
        )

      if (
        parsed &&
        typeof parsed ===
          'object'
      ) {
        return parsed
      }
    } catch {
      // Try the next safe repair candidate.
    }
  }

  return null
}

function parseLooseRecipeText(
  value,
  fallbackName,
) {
  const text =
    normalizeAiJsonText(
      value,
    )
      .replace(
        /\r/g,
        '',
      )

  if (
    !text
  ) {
    return null
  }

  const lines =
    text
      .split(
        '\n',
      )
      .map((line) =>
        line
          .replace(
            /^\s{0,3}#{1,6}\s*/,
            '',
          )
          .replace(
            /^\s*>\s*/,
            '',
          )
          .trim(),
      )
      .filter(
        Boolean,
      )

  const sections = {
    ingredients:
      [],

    steps:
      [],

    tips:
      [],

    substitutions:
      [],
  }

  let section =
    ''

  let name =
    cleanAiText(
      fallbackName,
      100,
    )

  let cuisine =
    ''

  let servings =
    ''

  let totalTime =
    ''

  let difficulty =
    ''

  let description =
    ''

  for (
    const rawLine of
    lines
  ) {
    const line =
      rawLine.replace(
        /\*\*/g,
        '',
      )

    const lower =
      line.toLowerCase()

    if (
      /^(ingredients?|what you need)\s*:?$/.test(
        lower,
      )
    ) {
      section =
        'ingredients'

      continue
    }

    if (
      /^(instructions?|method|directions?|steps?|cooking steps?)\s*:?$/.test(
        lower,
      )
    ) {
      section =
        'steps'

      continue
    }

    if (
      /^(tips?|chef.?s tips?)\s*:?$/.test(
        lower,
      )
    ) {
      section =
        'tips'

      continue
    }

    if (
      /^(substitutions?|swaps?|alternatives?)\s*:?$/.test(
        lower,
      )
    ) {
      section =
        'substitutions'

      continue
    }

    const metadataMatch =
      line.match(
        /^(cuisine|servings?|total\s*time|time|difficulty)\s*:\s*(.+)$/i,
      )

    if (
      metadataMatch
    ) {
      const key =
        metadataMatch[1]
          .toLowerCase()
          .replace(
            /\s+/g,
            '',
          )

      const metadataValue =
        cleanAiText(
          metadataMatch[2],
          80,
        )

      if (
        key ===
          'cuisine'
      ) {
        cuisine =
          metadataValue
      } else if (
        key ===
          'serving' ||
        key ===
          'servings'
      ) {
        servings =
          metadataValue
      } else if (
        key ===
          'totaltime' ||
        key ===
          'time'
      ) {
        totalTime =
          metadataValue
      } else if (
        key ===
          'difficulty'
      ) {
        difficulty =
          metadataValue
      }

      continue
    }

    const cleanedListLine =
      line
        .replace(
          /^[-*•]\s+/,
          '',
        )
        .replace(
          /^\d+[.)]\s+/,
          '',
        )
        .replace(
          /^step\s+\d+\s*[:.)-]?\s*/i,
          '',
        )
        .trim()

    if (
      !cleanedListLine
    ) {
      continue
    }

    if (
      section &&
      sections[section]
    ) {
      sections[section].push(
        cleanedListLine,
      )

      continue
    }

    if (
      !name &&
      line.length <=
        100
    ) {
      name =
        cleanAiText(
          line,
          100,
        )

      continue
    }

    if (
      !description &&
      line.length >
        20
    ) {
      description =
        cleanAiText(
          line,
          500,
        )
    }
  }

  const ingredients =
    sections.ingredients
      .map((line) => {
        const quantityMatch =
          line.match(
            /^((?:\d+(?:\.\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|–|to)\s*(?:\d+(?:\.\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]))?\s*(?:g|kg|mg|ml|l|cup|cups|tbsp|tsp|teaspoons?|tablespoons?|oz|lb|lbs|cloves?|pieces?|pinch|handful)?)\s+(.+)$/i,
          )

        return {
          item:
            cleanAiText(
              quantityMatch
                ? quantityMatch[2]
                : line,
              120,
            ),

          amount:
            cleanAiText(
              quantityMatch
                ? quantityMatch[1]
                : '',
              60,
            ),

          note:
            '',
        }
      })
      .filter((item) =>
        Boolean(
          item.item,
        ),
      )
      .slice(
        0,
        30,
      )

  const steps =
    sections.steps
      .map((line, index) => ({
        step:
          index +
          1,

        instruction:
          cleanAiText(
            line,
            500,
          ),

        time:
          cleanAiText(
            line.match(
              /\b(\d+\s*(?:minutes?|mins?|hours?|hrs?))\b/i,
            )?.[1] ||
              '',
            50,
          ),
      }))
      .filter((item) =>
        Boolean(
          item.instruction,
        ),
      )
      .slice(
        0,
        24,
      )

  if (
    ingredients.length ===
      0 ||
    steps.length ===
      0
  ) {
    return null
  }

  return {
    recipe: {
      name:
        name ||
        cleanAiText(
          fallbackName,
          100,
        ),

      description,
      cuisine,
      servings,
      totalTime,
      difficulty,
      ingredients,
      steps,

      tips:
        sections.tips.slice(
          0,
          8,
        ),

      substitutions:
        sections.substitutions.slice(
          0,
          8,
        ),
    },
  }
}

function parseAiJsonContent(
  content,
) {
  const text =
    extractAiContentText(
      content,
    ).trim()

  if (
    !text
  ) {
    throw new ApiError(
      502,
      'AI cooking assistant returned an invalid response.',
      [
        {
          code:
            'AI_COOK_INVALID_CONTENT',
        },
      ],
    )
  }

  const parsed =
    tryParseAiJson(
      text,
    )

  if (
    parsed
  ) {
    return parsed
  }

  return {
    __rawText:
      text,
  }
}

function normalizeAiSuggestions(
  payload,
) {
  const suggestions =
    Array.isArray(
      payload?.suggestions,
    )
      ? payload.suggestions
      : []

  const normalized =
    suggestions
      .map((item) => ({
        name:
          cleanAiText(
            item?.name,
            100,
          ),

        cuisine:
          cleanAiText(
            item?.cuisine,
            60,
          ),

        estimatedTime:
          cleanAiText(
            item?.estimatedTime,
            40,
          ),

        difficulty:
          cleanAiText(
            item?.difficulty,
            30,
          ),

        whyItFits:
          cleanAiText(
            item?.whyItFits,
            260,
          ),

        uses:
          cleanAiStringList(
            item?.uses,
            10,
          ),

        optionalExtras:
          cleanAiStringList(
            item?.optionalExtras,
            8,
          ),
      }))
      .filter((item) =>
        Boolean(
          item.name,
        ),
      )
      .slice(
        0,
        4,
      )

  if (
    normalized.length <
      1
  ) {
    throw new ApiError(
      502,
      'AI cooking assistant could not create usable dish ideas.',
      [
        {
          code:
            'AI_COOK_EMPTY_SUGGESTIONS',
        },
      ],
    )
  }

  return normalized
}

function normalizeAiRecipe(
  payload,
  fallbackName,
) {
  const loosePayload =
    typeof payload?.__rawText ===
      'string'
      ? parseLooseRecipeText(
          payload.__rawText,
          fallbackName,
        )
      : null

  const sourcePayload =
    loosePayload ||
    payload

  const recipe =
    sourcePayload?.recipe &&
    typeof sourcePayload.recipe ===
      'object'
      ? sourcePayload.recipe
      : sourcePayload

  const ingredients =
    Array.isArray(
      recipe?.ingredients,
    )
      ? recipe.ingredients
          .map((item) => ({
            item:
              cleanAiText(
                item?.item,
                120,
              ),

            amount:
              cleanAiText(
                item?.amount,
                60,
              ),

            note:
              cleanAiText(
                item?.note,
                160,
              ),
          }))
          .filter((item) =>
            Boolean(
              item.item,
            ),
          )
          .slice(
            0,
            30,
          )
      : []

  const steps =
    Array.isArray(
      recipe?.steps,
    )
      ? recipe.steps
          .map((item, index) => ({
            step:
              Number.isInteger(
                Number(
                  item?.step,
                ),
              )
                ? Number(
                    item.step,
                  )
                : index +
                  1,

            instruction:
              cleanAiText(
                item?.instruction,
                500,
              ),

            time:
              cleanAiText(
                item?.time,
                50,
              ),
          }))
          .filter((item) =>
            Boolean(
              item.instruction,
            ),
          )
          .slice(
            0,
            24,
          )
      : []

  if (
    ingredients.length ===
      0 ||
    steps.length ===
      0
  ) {
    throw new ApiError(
      502,
      'AI cooking assistant returned an incomplete recipe.',
      [
        {
          code:
            'AI_COOK_INCOMPLETE_RECIPE',
        },
      ],
    )
  }

  return {
    name:
      cleanAiText(
        recipe?.name ||
          fallbackName,
        100,
      ),

    description:
      cleanAiText(
        recipe?.description,
        500,
      ),

    cuisine:
      cleanAiText(
        recipe?.cuisine,
        60,
      ),

    servings:
      cleanAiText(
        recipe?.servings,
        40,
      ),

    totalTime:
      cleanAiText(
        recipe?.totalTime,
        50,
      ),

    difficulty:
      cleanAiText(
        recipe?.difficulty,
        30,
      ),

    ingredients,

    steps,

    tips:
      cleanAiStringList(
        recipe?.tips,
        8,
      ),

    substitutions:
      cleanAiStringList(
        recipe?.substitutions,
        8,
      ),
  }
}

const AI_COOK_FREE_ROUTER_MODEL =
  'openrouter/free'

function getAiCookErrorCode(
  error,
) {
  return (
    error?.code ||
    error?.errors?.[0]
      ?.code ||
    'AI_COOK_FAILED'
  )
}

function getAiCookErrorStatus(
  error,
) {
  const status =
    Number(
      error?.status ||
        error?.statusCode,
    )

  return Number.isInteger(
    status,
  )
    ? status
    : null
}

function shouldRetryAiCookWithFreeRouter(
  error,
) {
  const code =
    getAiCookErrorCode(
      error,
    )

  const status =
    getAiCookErrorStatus(
      error,
    )

  if (
    code ===
      'OPENROUTER_EMPTY_RESPONSE' ||
    code ===
      'OPENROUTER_TIMEOUT' ||
    code ===
      'AI_COOK_INVALID_CONTENT' ||
    code ===
      'AI_COOK_INVALID_JSON' ||
    code ===
      'AI_COOK_EMPTY_SUGGESTIONS' ||
    code ===
      'AI_COOK_INCOMPLETE_RECIPE'
  ) {
    return true
  }

  if (
    code !==
      'OPENROUTER_REQUEST_FAILED'
  ) {
    return false
  }

  return [
    400,
    404,
    408,
    409,
    500,
    502,
    503,
    504,
  ].includes(
    status,
  )
}

async function runAiCookStructuredCompletion({
  messages,
  temperature,
  maxTokens,
  normalize,
  useJsonResponseFormat =
    true,
  timeoutMs,
}) {
  const configuredModel =
    getOpenRouterConfig(
      'copilot',
    ).model

  const execute =
    async ({
      model,
      useResponseFormat,
    }) => {
      const response =
        await createOpenRouterChatCompletion({
          task:
            'copilot',

          model,

          messages,

          responseFormat:
            useResponseFormat
              ? {
                  type:
                    'json_object',
                }
              : undefined,

          temperature,

          maxTokens,

          timeoutMs,
        })

      const payload =
        parseAiJsonContent(
          response?.message?.content,
        )

      return {
        response,

        value:
          normalize(
            payload,
          ),
      }
    }

  try {
    return await execute({
      model:
        undefined,

      useResponseFormat:
        useJsonResponseFormat,
    })
  } catch (
    primaryError
  ) {
    const shouldFallback =
      configuredModel !==
        AI_COOK_FREE_ROUTER_MODEL &&
      shouldRetryAiCookWithFreeRouter(
        primaryError,
      )

    if (
      !shouldFallback
    ) {
      throw primaryError
    }

    return execute({
      model:
        AI_COOK_FREE_ROUTER_MODEL,

      useResponseFormat:
        false,
    })
  }
}

function aiCookUnavailableError(
  error,
) {
  const code =
    getAiCookErrorCode(
      error,
    )

  const status =
    getAiCookErrorStatus(
      error,
    )

  if (
    code ===
      'OPENROUTER_NOT_CONFIGURED'
  ) {
    return new ApiError(
      503,
      'AI cooking assistant is not configured yet.',
      [
        {
          code,
        },
      ],
    )
  }

  if (
    code ===
      'OPENROUTER_TIMEOUT'
  ) {
    return new ApiError(
      504,
      'AI cooking assistant took too long to respond. Please try again.',
      [
        {
          code,
        },
      ],
    )
  }

  if (
    code ===
      'OPENROUTER_REQUEST_FAILED' &&
    (
      status ===
        401 ||
      status ===
        403
    )
  ) {
    return new ApiError(
      503,
      'OpenRouter rejected the AI API key. Check OPENROUTER_API_KEY and restart the backend.',
      [
        {
          code,
          status,
        },
      ],
    )
  }

  if (
    code ===
      'OPENROUTER_REQUEST_FAILED' &&
    status ===
      429
  ) {
    return new ApiError(
      429,
      'OpenRouter free-model rate limit is currently reached. Please try again later or use an API key with available free-model quota.',
      [
        {
          code:
            'OPENROUTER_RATE_LIMITED',
          status,
        },
      ],
    )
  }

  if (
    code ===
      'OPENROUTER_REQUEST_FAILED' &&
    status ===
      402
  ) {
    return new ApiError(
      503,
      'OpenRouter has no usable quota for this request. Check the OpenRouter account linked to OPENROUTER_API_KEY.',
      [
        {
          code:
            'OPENROUTER_QUOTA_UNAVAILABLE',
          status,
        },
      ],
    )
  }

  if (
    error instanceof
      ApiError
  ) {
    return error
  }

  if (
    code ===
      'OPENROUTER_REQUEST_FAILED'
  ) {
    return new ApiError(
      502,
      status
        ? `OpenRouter could not serve the AI cooking request (status ${status}). Please try again.`
        : 'OpenRouter could not serve the AI cooking request. Please try again.',
      [
        {
          code,
          status,
        },
      ],
    )
  }

  return new ApiError(
    502,
    'AI cooking assistant is temporarily unavailable.',
    [
      {
        code,
      },
    ],
  )
}

export async function generateAiCook({
  action,
  ingredients,
  dishName =
    '',
}) {
  if (
    !isOpenRouterConfigured(
      'copilot',
    )
  ) {
    throw aiCookUnavailableError({
      code:
        'OPENROUTER_NOT_CONFIGURED',
    })
  }

  const pantryText =
    cleanAiText(
      ingredients,
      1200,
    )

  try {
    if (
      action ===
        'suggestions'
    ) {
      const messages = [
        {
          role:
            'system',

          content:
            'You are EPANTRY Cook Today, a practical home-cooking assistant. Suggest realistic dishes based primarily on ingredients the user says they already have. Never invent that the user has an ingredient. Small pantry basics may be listed only as optional extras. Return one valid JSON object only, with no markdown and no text before or after the JSON.',
        },
        {
          role:
            'user',

          content:
            `Available ingredients: ${pantryText}\n\nReturn 3 or 4 useful dish ideas. Use exactly this JSON shape: {"suggestions":[{"name":"","cuisine":"","estimatedTime":"","difficulty":"Easy|Medium|Advanced","whyItFits":"","uses":[""],"optionalExtras":[""]}]}. Keep ideas diverse and practical.`,
        },
      ]

      const result =
        await runAiCookStructuredCompletion({
          messages,

          temperature:
            0.35,

          maxTokens:
            1100,

          normalize:
            normalizeAiSuggestions,
        })

      return {
        action:
          'suggestions',

        ingredients:
          pantryText,

        modelId:
          result.response
            ?.modelId ||
          '',

        suggestions:
          result.value,
      }
    }

    const normalizedDishName =
      cleanAiText(
        dishName,
        100,
      )

    const messages = [
      {
        role:
          'system',

        content:
          'You are EPANTRY Cook Today, a practical home-cooking assistant. Write a complete, usable home recipe for the selected dish. Base it on the ingredients the user says they have. Clearly identify optional or substitute ingredients instead of pretending they are available. Include safe, ordinary cooking guidance. For full recipes, use the exact plain-text headings requested by the user and do not wrap the answer in JSON or markdown code fences.',
      },
      {
        role:
          'user',

        content:
          `Available ingredients: ${pantryText}\nSelected dish: ${normalizedDishName}\n\nReturn a complete recipe using exactly these headings and this simple text structure:\nCuisine: ...\nServings: ...\nTotal Time: ...\nDifficulty: Easy|Medium|Advanced\nIngredients:\n- concrete amount + ingredient + preparation note\nSteps:\n1. clear instruction with practical timing where useful\nTips:\n- tip\nSubstitutions:\n- substitution\n\nUse maximum 12 ingredients, maximum 10 steps, maximum 4 tips and 4 substitutions. Keep every step under 28 words. Do not omit the Ingredients or Steps sections.`,
      },
    ]

    const result =
      await runAiCookStructuredCompletion({
        messages,

        temperature:
          0.25,

        maxTokens:
          1800,

        timeoutMs:
          55000,

        normalize:
          (
            payload,
          ) =>
            normalizeAiRecipe(
              payload,
              normalizedDishName,
            ),

        useJsonResponseFormat:
          false,
      })

    return {
      action:
        'recipe',

      ingredients:
        pantryText,

      modelId:
        result.response
          ?.modelId ||
        '',

      recipe:
        result.value,
    }
  } catch (error) {
    throw aiCookUnavailableError(
      error,
    )
  }
}

export async function getWhatShouldWeCook({
  ingredientIds,
  limit,
}) {
  const currentVersions =
    await RecipeVersion.find(
      currentPublishedFilter(),
    )
      .sort({
        versionNumber:
          -1,
      })
      .limit(
        500,
      )
      .lean()

  const versionByDish =
    new Map()

  for (
    const version of
    currentVersions
  ) {
    const dishId =
      String(
        version.dishId,
      )

    if (
      !versionByDish.has(
        dishId,
      )
    ) {
      versionByDish.set(
        dishId,
        version,
      )
    }
  }

  const dishes =
    await Dish.find({
      _id: {
        $in:
          [
            ...versionByDish.keys(),
          ],
      },

      status:
        'active',
    }).lean()

  const versionIds =
    dishes
      .map(
        (
          dish,
        ) =>
          versionByDish.get(
            String(
              dish._id,
            ),
          )?._id,
      )
      .filter(
        Boolean,
      )

  const ingredientRows =
    await RecipeIngredient.find({
      recipeVersionId: {
        $in:
          versionIds,
      },
    }).lean()

  const rowsByVersion =
    new Map()

  for (
    const row of
    ingredientRows
  ) {
    const key =
      String(
        row.recipeVersionId,
      )

    if (
      !rowsByVersion.has(
        key,
      )
    ) {
      rowsByVersion.set(
        key,
        [],
      )
    }

    rowsByVersion
      .get(
        key,
      )
      .push(
        row,
      )
  }

  const ranked =
    rankRecipeCandidatesByPantry({
      candidates:
        dishes.map(
          (
            dish,
          ) => {
            const recipeVersion =
              versionByDish.get(
                String(
                  dish._id,
                ),
              )

            return {
              dish:
                serializePublicDish(
                  dish,
                ),

              recipe:
                serializePublicRecipeVersion(
                  recipeVersion,
                ),

              path:
                `/recipes/${dish.slug}`,

              ingredientRows:
                rowsByVersion.get(
                  String(
                    recipeVersion._id,
                  ),
                ) ||
                [],
            }
          },
        ),

      availableIngredientIds:
        ingredientIds,

      limit,
    })

  return {
    ingredientIds,

    recipes:
      ranked.map(
        (
          result,
        ) => ({
          dish:
            result.dish,

          recipe:
            result.recipe,

          path:
            result.path,

          matching:
            result.matching,
        }),
      ),
  }
}