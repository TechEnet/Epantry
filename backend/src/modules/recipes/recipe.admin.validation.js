import {
  z,
} from 'zod'

import {
  RECIPE_DIFFICULTIES,
  RECIPE_INGREDIENT_ROLES,
  RECIPE_INGREDIENT_SCALING_RULE_TYPES,
  RECIPE_SCALING_METHODS,
  RECIPE_SOURCE_TYPES,
  RECIPE_UNITS,
} from './recipe.constants.js'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      objectIdPattern,
      'A valid MongoDB ObjectId is required.',
    )

const optionalUrlSchema =
  z
    .union([
      z
        .string()
        .trim()
        .url()
        .max(
          2048,
        ),

      z
        .literal(
          '',
        ),
    ])
    .optional()
    .default(
      '',
    )

const recipeSourceSchema =
  z
    .object({
      type:
        z
          .enum(
            RECIPE_SOURCE_TYPES,
          )
          .default(
            'internal',
          ),

      name:
        z
          .string()
          .trim()
          .max(
            180,
          )
          .optional()
          .default(
            '',
          ),

      url:
        optionalUrlSchema,

      brandId:
        objectIdSchema
          .nullable()
          .optional()
          .default(
            null,
          ),

      organizationId:
        objectIdSchema
          .nullable()
          .optional()
          .default(
            null,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.type ===
            'brand' &&
          !value.brandId
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'brandId',
            ],

            message:
              'Brand-attributed Recipe requires brandId.',
          })
        }
      },
    )

const scalingRuleSchema =
  z
    .object({
      type:
        z
          .enum(
            RECIPE_INGREDIENT_SCALING_RULE_TYPES,
          )
          .default(
            'linear',
          ),

      exponent:
        z
          .number()
          .min(
            0,
          )
          .max(
            5,
          )
          .default(
            1,
          ),

      minMultiplier:
        z
          .number()
          .min(
            0,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),

      maxMultiplier:
        z
          .number()
          .min(
            0,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.minMultiplier !==
            null &&
          value.maxMultiplier !==
            null &&
          value.minMultiplier >
            value.maxMultiplier
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'maxMultiplier',
            ],

            message:
              'maxMultiplier cannot be below minMultiplier.',
          })
        }
      },
    )

const ingredientSchema =
  z
    .object({
      lineNumber:
        z
          .number()
          .int()
          .min(
            1,
          ),

      canonicalIngredientId:
        objectIdSchema,

      quantity:
        z
          .number()
          .positive()
          .finite(),

      unit:
        z.enum(
          RECIPE_UNITS,
        ),

      preparationState:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(
            '',
          ),

      optional:
        z
          .boolean()
          .optional()
          .default(
            false,
          ),

      role:
        z
          .enum(
            RECIPE_INGREDIENT_ROLES,
          )
          .optional()
          .default(
            'main',
          ),

      notes:
        z
          .string()
          .trim()
          .max(
            1000,
          )
          .optional()
          .default(
            '',
          ),

      substitutionGroupKey:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      productConstraints:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
              )
              .max(
                160,
              ),
          )
          .max(
            30,
          )
          .optional()
          .default(
            [],
          ),

      scalingRule:
        scalingRuleSchema
          .optional()
          .default({
            type:
              'linear',

            exponent:
              1,

            minMultiplier:
              null,

            maxMultiplier:
              null,
          }),
    })
    .strict()

const recipeStepSchema =
  z
    .object({
      stepNumber:
        z
          .number()
          .int()
          .min(
            1,
          ),

      instruction:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            4000,
          ),

      timerSeconds:
        z
          .number()
          .int()
          .min(
            0,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),

      temperatureValue:
        z
          .number()
          .finite()
          .nullable()
          .optional()
          .default(
            null,
          ),

      temperatureUnit:
        z
          .enum([
            'c',
            'f',
          ])
          .nullable()
          .optional()
          .default(
            null,
          ),

      equipment:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
              )
              .max(
                120,
              ),
          )
          .max(
            30,
          )
          .optional()
          .default(
            [],
          ),

      parallelizable:
        z
          .boolean()
          .optional()
          .default(
            false,
          ),

      prepAhead:
        z
          .boolean()
          .optional()
          .default(
            false,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        const hasValue =
          value.temperatureValue !==
          null

        const hasUnit =
          value.temperatureUnit !==
          null

        if (
          hasValue !==
          hasUnit
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'temperatureUnit',
            ],

            message:
              'Temperature value and unit must be supplied together.',
          })
        }
      },
    )

const substitutionSchema =
  z
    .object({
      sourceIngredientLineNumber:
        z
          .number()
          .int()
          .min(
            1,
          ),

      substituteCanonicalIngredientId:
        objectIdSchema,

      replacementRatio:
        z
          .number()
          .positive()
          .finite()
          .optional()
          .default(
            1,
          ),

      replacementUnit:
        z
          .enum(
            RECIPE_UNITS,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),

      priority:
        z
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          )
          .optional()
          .default(
            1,
          ),

      notes:
        z
          .string()
          .trim()
          .max(
            1000,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()

const recipeDraftContentShape = {
  title:
    z
      .string()
      .trim()
      .min(
        1,
      )
      .max(
        180,
      ),

  recipeDescription:
    z
      .string()
      .trim()
      .max(
        4000,
      )
      .optional()
      .default(
        '',
      ),

  baseServings:
    z
      .number()
      .int()
      .min(
        1,
      )
      .max(
        1000,
      ),

  servingSizeAmount:
    z
      .number()
      .positive()
      .finite()
      .nullable()
      .optional()
      .default(
        null,
      ),

  servingSizeUnit:
    z
      .enum(
        RECIPE_UNITS,
      )
      .nullable()
      .optional()
      .default(
        null,
      ),

  finishedYieldAmount:
    z
      .number()
      .positive()
      .finite()
      .nullable()
      .optional()
      .default(
        null,
      ),

  finishedYieldUnit:
    z
      .enum(
        RECIPE_UNITS,
      )
      .nullable()
      .optional()
      .default(
        null,
      ),

  scalingMethod:
    z
      .enum(
        RECIPE_SCALING_METHODS,
      )
      .default(
        'linear',
      ),

  minRecommendedServings:
    z
      .number()
      .int()
      .min(
        1,
      )
      .nullable()
      .optional()
      .default(
        null,
      ),

  maxRecommendedServings:
    z
      .number()
      .int()
      .min(
        1,
      )
      .nullable()
      .optional()
      .default(
        null,
      ),

  preparationTimeMinutes:
    z
      .number()
      .int()
      .min(
        0,
      )
      .max(
        10080,
      )
      .optional()
      .default(
        0,
      ),

  cookingTimeMinutes:
    z
      .number()
      .int()
      .min(
        0,
      )
      .max(
        10080,
      )
      .optional()
      .default(
        0,
      ),

  difficulty:
    z
      .enum(
        RECIPE_DIFFICULTIES,
      )
      .default(
        'easy',
      ),

  source:
    recipeSourceSchema
      .optional()
      .default({
        type:
          'internal',

        name:
          '',

        url:
          '',

        brandId:
          null,

        organizationId:
          null,
      }),

  unsafeIncomplete:
    z
      .boolean()
      .optional()
      .default(
        false,
      ),

  unsafeIncompleteReason:
    z
      .string()
      .trim()
      .max(
        1000,
      )
      .optional()
      .default(
        '',
      ),

  ingredients:
    z
      .array(
        ingredientSchema,
      )
      .min(
        1,
      )
      .max(
        250,
      ),

  steps:
    z
      .array(
        recipeStepSchema,
      )
      .min(
        1,
      )
      .max(
        250,
      ),

  substitutions:
    z
      .array(
        substitutionSchema,
      )
      .max(
        250,
      )
      .optional()
      .default(
        [],
      ),
}

function addRecipeContentIssues(
  value,
  context,
) {
  if (
    value.minRecommendedServings !==
      null &&
    value.maxRecommendedServings !==
      null &&
    value.minRecommendedServings >
      value.maxRecommendedServings
  ) {
    context.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'maxRecommendedServings',
      ],

      message:
        'Maximum recommended servings cannot be below minimum recommended servings.',
    })
  }

  const ingredientLines =
    value.ingredients.map(
      (
        ingredient,
      ) =>
        ingredient.lineNumber,
    )

  if (
    new Set(
      ingredientLines,
    ).size !==
    ingredientLines.length
  ) {
    context.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'ingredients',
      ],

      message:
        'Ingredient line numbers must be unique.',
    })
  }

  const stepNumbers =
    value.steps.map(
      (
        step,
      ) =>
        step.stepNumber,
    )

  if (
    new Set(
      stepNumbers,
    ).size !==
    stepNumbers.length
  ) {
    context.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'steps',
      ],

      message:
        'Recipe step numbers must be unique.',
    })
  }

  const ingredientLineSet =
    new Set(
      ingredientLines,
    )

  for (
    const [
      index,
      substitution,
    ]
    of value.substitutions.entries()
  ) {
    if (
      !ingredientLineSet.has(
        substitution.sourceIngredientLineNumber,
      )
    ) {
      context.addIssue({
        code:
          z.ZodIssueCode.custom,

        path: [
          'substitutions',
          index,
          'sourceIngredientLineNumber',
        ],

        message:
          'Substitution must reference an existing Recipe ingredient line.',
      })
    }
  }

  if (
    value.unsafeIncomplete &&
    !value.unsafeIncompleteReason
  ) {
    context.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'unsafeIncompleteReason',
      ],

      message:
        'Unsafe/incomplete Recipes require an explanation.',
    })
  }
}

export const createAdminRecipeSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            180,
          ),

      slug:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            220,
          )
          .optional(),

      description:
        z
          .string()
          .trim()
          .max(
            4000,
          )
          .optional()
          .default(
            '',
          ),

      cuisine:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      course:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      tags:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
              )
              .max(
                80,
              ),
          )
          .max(
            40,
          )
          .optional()
          .default(
            [],
          ),

      language:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            16,
          )
          .optional()
          .default(
            'en',
          ),

      heroImageUrl:
        optionalUrlSchema,

      ...recipeDraftContentShape,
    })
    .strict()
    .superRefine(
      addRecipeContentIssues,
    )


export const updateAdminRecipeImageSchema =
  z
    .object({
      heroImageUrl:
        optionalUrlSchema,
    })
    .strict()

export const updateAdminRecipeDraftSchema =
  z
    .object(
      recipeDraftContentShape,
    )
    .strict()
    .superRefine(
      addRecipeContentIssues,
    )

export const createNextRecipeVersionSchema =
  z
    .object({
      sourceRecipeVersionId:
        objectIdSchema
          .optional(),

      changeReason:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            1000,
          ),
    })
    .strict()

export const adminDishIdParamsSchema =
  z
    .object({
      dishId:
        objectIdSchema,
    })
    .strict()

export const adminRecipeVersionIdParamsSchema =
  z
    .object({
      versionId:
        objectIdSchema,
    })
    .strict()

export const listAdminRecipesQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .default(
            1,
          ),

      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          )
          .default(
            25,
          ),

      status:
        z
          .enum([
            'all',
            'active',
            'disabled',
            'retired',
          ])
          .default(
            'all',
          ),

      search:
        z
          .string()
          .trim()
          .max(
            160,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()