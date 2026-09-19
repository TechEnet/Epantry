import {
  z,
} from 'zod'

import {
  ALLERGEN_RELATION_TYPES,
  FOOD_EVIDENCE_STATES,
} from './foodIntelligence.constants.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const evidenceStateSchema =
  z.enum(
    FOOD_EVIDENCE_STATES,
  )

const sourceReferenceSchema =
  z
    .object({
      canonicalIngredientId:
        objectIdSchema,

      evidenceSourceId:
        objectIdSchema,

      sourceVersion:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      evidenceState:
        evidenceStateSchema,

      allergenEvidenceComplete:
        z.boolean(),

      nutrientEvidenceComplete:
        z.boolean(),
    })
    .strict()

const nutrientValueSchema =
  z
    .object({
      nutrientId:
        objectIdSchema,

      amount:
        z
          .number()
          .finite()
          .min(0),

      unit:
        z
          .string()
          .trim()
          .min(1)
          .max(40),
    })
    .strict()

const productNutrientComponentSchema =
  z
    .object({
      canonicalIngredientId:
        objectIdSchema,

      evidenceSourceId:
        objectIdSchema,

      sourceVersion:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      evidenceState:
        evidenceStateSchema,

      quantityFactor:
        z
          .number()
          .finite()
          .min(0)
          .default(
            1,
          ),

      nutrients:
        z
          .array(
            nutrientValueSchema,
          )
          .min(1),
    })
    .strict()

const dietaryFactValueSchema =
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
  ])

const dietaryEvaluationSchema =
  z
    .object({
      ruleProfileId:
        objectIdSchema,

      factMap:
        z.record(
          z.string(),
          dietaryFactValueSchema,
        ),
    })
    .strict()

const assumptionSchema =
  z.record(
    z.string(),
    z.unknown(),
  )

export const calculateProductFoodIntelligenceSchema =
  z
    .object({
      jurisdictionCode:
        z
          .string()
          .trim()
          .min(2)
          .max(20),

      entityEvidenceState:
        evidenceStateSchema,

      basis:
        z
          .string()
          .trim()
          .min(3)
          .max(500),

      dietaryEvidenceComplete:
        z.boolean(),

      ingredientSources:
        z
          .array(
            sourceReferenceSchema,
          )
          .min(1),

      nutrientComponents:
        z
          .array(
            productNutrientComponentSchema,
          )
          .default(
            [],
          ),

      dietaryEvaluations:
        z
          .array(
            dietaryEvaluationSchema,
          )
          .default(
            [],
          ),

      assumptions:
        z
          .array(
            assumptionSchema,
          )
          .default(
            [],
          ),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),
    })
    .strict()

const recipeIngredientProfileSchema =
  z
    .object({
      canonicalIngredientId:
        objectIdSchema,

      evidenceSourceId:
        objectIdSchema,

      sourceVersion:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      evidenceState:
        evidenceStateSchema,

      allergenEvidenceComplete:
        z.boolean(),

      nutrientEvidenceComplete:
        z.boolean(),

      basisQuantity:
        z
          .number()
          .finite()
          .positive(),

      basisUnit:
        z
          .string()
          .trim()
          .min(1)
          .max(40),

      nutrients:
        z
          .array(
            nutrientValueSchema,
          )
          .default(
            [],
          ),
    })
    .strict()

const yieldFactorSchema =
  z
    .object({
      key:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      multiplier:
        z
          .number()
          .finite()
          .min(0)
          .max(10),
    })
    .strict()

export const calculateRecipeFoodIntelligenceSchema =
  z
    .object({
      jurisdictionCode:
        z
          .string()
          .trim()
          .min(2)
          .max(20),

      entityEvidenceState:
        evidenceStateSchema,

      basis:
        z
          .string()
          .trim()
          .min(3)
          .max(500),

      optionalIngredientPolicy:
        z.enum([
          'include',
          'exclude',
        ]),

      dietaryEvidenceComplete:
        z.boolean(),

      ingredientProfiles:
        z
          .array(
            recipeIngredientProfileSchema,
          )
          .min(1),

      dietaryEvaluations:
        z
          .array(
            dietaryEvaluationSchema,
          )
          .default(
            [],
          ),

      yieldFactors:
        z
          .array(
            yieldFactorSchema,
          )
          .default(
            [],
          ),

      assumptions:
        z
          .array(
            assumptionSchema,
          )
          .default(
            [],
          ),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),
    })
    .strict()



const declaredRecipeNutritionSchema =
  z
    .object({
      key:
        z.enum([
          'energy',
          'protein',
          'carbohydrate',
          'total_fat',
          'saturated_fat',
          'fiber',
          'total_sugars',
          'sodium',
        ]),

      amount:
        z
          .number()
          .finite()
          .min(0),

      unit:
        z.enum([
          'kcal',
          'g',
          'mg',
        ]),
    })
    .strict()

const declaredRecipeAllergenSchema =
  z
    .object({
      key:
        z
          .string()
          .trim()
          .min(2)
          .max(80),

      canonicalName:
        z
          .string()
          .trim()
          .min(2)
          .max(160),

      relationship:
        z.enum(
          ALLERGEN_RELATION_TYPES,
        ),
    })
    .strict()

export const declareRecipeFoodIntelligenceSchema =
  z
    .object({
      jurisdictionCode:
        z
          .string()
          .trim()
          .min(2)
          .max(20)
          .default(
            'IN',
          ),

      nutrition:
        z
          .array(
            declaredRecipeNutritionSchema,
          )
          .max(20)
          .default(
            [],
          ),

      allergens:
        z
          .array(
            declaredRecipeAllergenSchema,
          )
          .max(30)
          .default(
            [],
          ),

      dietaryClassification:
        z.enum([
          'not_declared',
          'vegetarian',
          'vegan',
          'eggitarian',
          'non_vegetarian',
        ]),

      basis:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.nutrition.length ===
            0 &&
          value.allergens.length ===
            0 &&
          value.dietaryClassification ===
            'not_declared'
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'nutrition',
            ],

            message:
              'Enter nutrition, an allergen relationship, or a dietary classification before saving Food Intelligence.',
          })
        }

        const nutritionKeys =
          new Set()

        for (
          const item
          of value.nutrition
        ) {
          if (
            nutritionKeys.has(
              item.key,
            )
          ) {
            context.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'nutrition',
              ],

              message:
                `Nutrition key ${item.key} is duplicated.`,
            })
          }

          nutritionKeys.add(
            item.key,
          )
        }

        const allergenKeys =
          new Set()

        for (
          const item
          of value.allergens
        ) {
          const key =
            item.key
              .trim()
              .toLowerCase()
              .replace(
                /[^a-z0-9]+/g,
                '_',
              )
              .replace(
                /^_+|_+$/g,
                '',
              )

          if (
            allergenKeys.has(
              key,
            )
          ) {
            context.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'allergens',
              ],

              message:
                `Allergen ${item.canonicalName} is duplicated.`,
            })
          }

          allergenKeys.add(
            key,
          )
        }
      },
    )

const declaredProductDietarySchema =
  z
    .object({
      key:
        z.enum([
          'vegetarian',
          'vegan',
          'gluten_free',
          'eggitarian',
          'non_vegetarian',
        ]),

      outcome:
        z.enum([
          'eligible',
          'not_eligible',
        ]),
    })
    .strict()

export const declareProductFoodIntelligenceSchema =
  z
    .object({
      jurisdictionCode:
        z
          .string()
          .trim()
          .min(2)
          .max(20)
          .default(
            'IN',
          ),

      nutritionBasis:
        z.enum([
          'per_100g',
          'per_100ml',
          'per_serving',
          'per_pack',
        ]),

      nutrition:
        z
          .array(
            declaredRecipeNutritionSchema,
          )
          .max(20)
          .default(
            [],
          ),

      allergens:
        z
          .array(
            declaredRecipeAllergenSchema,
          )
          .max(30)
          .default(
            [],
          ),

      allergenStatement:
        z
          .string()
          .trim()
          .max(1000)
          .default(''),

      dietary:
        z
          .array(
            declaredProductDietarySchema,
          )
          .max(10)
          .default(
            [],
          ),

      basis:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.nutrition.length ===
            0 &&
          value.allergens.length ===
            0 &&
          !value.allergenStatement &&
          value.dietary.length ===
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'nutrition',
            ],

            message:
              'Enter nutrition, an allergen relationship, or a dietary result before saving Product Food Intelligence.',
          })
        }

        const nutritionKeys =
          new Set()

        for (
          const item
          of value.nutrition
        ) {
          if (
            nutritionKeys.has(
              item.key,
            )
          ) {
            context.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'nutrition',
              ],

              message:
                `Nutrition key ${item.key} is duplicated.`,
            })
          }

          nutritionKeys.add(
            item.key,
          )
        }

        const allergenKeys =
          new Set()

        for (
          const item
          of value.allergens
        ) {
          const key =
            item.key
              .trim()
              .toLowerCase()
              .replace(
                /[^a-z0-9]+/g,
                '_',
              )
              .replace(
                /^_+|_+$/g,
                '',
              )

          if (
            allergenKeys.has(
              key,
            )
          ) {
            context.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'allergens',
              ],

              message:
                `Allergen ${item.canonicalName} is duplicated.`,
            })
          }

          allergenKeys.add(
            key,
          )
        }

        const dietaryKeys =
          new Set()

        for (
          const item
          of value.dietary
        ) {
          if (
            dietaryKeys.has(
              item.key,
            )
          ) {
            context.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'dietary',
              ],

              message:
                `Dietary key ${item.key} is duplicated.`,
            })
          }

          dietaryKeys.add(
            item.key,
          )
        }
      },
    )

export const foodEntityIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const productVersionFoodParamsSchema =
  z
    .object({
      productVersionId:
        objectIdSchema,
    })
    .strict()

export const recipeVersionFoodParamsSchema =
  z
    .object({
      recipeVersionId:
        objectIdSchema,
    })
    .strict()