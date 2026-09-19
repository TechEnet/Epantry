import {
  z,
} from 'zod'

import {
  ALLERGEN_RELATION_TYPES,
  FOOD_CALCULATION_ENTITY_TYPES,
  FOOD_CALCULATION_STATUSES,
  FOOD_EVIDENCE_STATES,
  FOOD_RULE_TYPES,
} from './foodIntelligence.constants.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

export const createIngredientRelationSchema =
  z
    .object({
      canonicalIngredientId:
        objectIdSchema,

      allergenId:
        objectIdSchema,

      relationType:
        z.enum(
          ALLERGEN_RELATION_TYPES,
        ),

      evidenceState:
        z.enum(
          FOOD_EVIDENCE_STATES,
        ),

      evidenceSourceId:
        objectIdSchema,

      effectiveFrom:
        z
          .coerce
          .date()
          .nullable()
          .default(
            null,
          ),

      effectiveTo:
        z
          .coerce
          .date()
          .nullable()
          .default(
            null,
          ),

      changeReason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),

      notes:
        z
          .string()
          .trim()
          .max(2000)
          .default(
            '',
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.effectiveFrom &&
          value.effectiveTo &&
          value.effectiveTo <=
            value.effectiveFrom
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'effectiveTo',
            ],

            message:
              'effectiveTo must be after effectiveFrom.',
          })
        }
      },
    )

export const foodGovernanceIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const lifecycleReasonSchema =
  z
    .object({
      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(1000),
    })
    .strict()

export const listIngredientRelationsQuerySchema =
  z
    .object({
      canonicalIngredientId:
        objectIdSchema
          .optional(),

      allergenId:
        objectIdSchema
          .optional(),

      status:
        z
          .enum([
            'draft',
            'active',
            'retired',
          ])
          .optional(),

      page:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .default(
            1,
          ),

      limit:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(
            50,
          ),
    })
    .strict()

export const createRuleProfileSchema =
  z
    .object({
      ruleKey:
        z
          .string()
          .trim()
          .min(2)
          .max(120),

      ruleType:
        z.enum(
          FOOD_RULE_TYPES,
        ),

      jurisdictionCode:
        z
          .string()
          .trim()
          .min(2)
          .max(20),

      definition:
        z.record(
          z.string(),
          z.unknown(),
        ),

      evidenceSourceIds:
        z
          .array(
            objectIdSchema,
          )
          .default(
            [],
          ),

      effectiveFrom:
        z
          .coerce
          .date()
          .nullable()
          .default(
            null,
          ),

      effectiveTo:
        z
          .coerce
          .date()
          .nullable()
          .default(
            null,
          ),

      changeReason:
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
          value.effectiveFrom &&
          value.effectiveTo &&
          value.effectiveTo <=
            value.effectiveFrom
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'effectiveTo',
            ],

            message:
              'effectiveTo must be after effectiveFrom.',
          })
        }
      },
    )

export const listRuleProfilesQuerySchema =
  z
    .object({
      ruleKey:
        z
          .string()
          .trim()
          .optional(),

      ruleType:
        z
          .enum(
            FOOD_RULE_TYPES,
          )
          .optional(),

      jurisdictionCode:
        z
          .string()
          .trim()
          .optional(),

      status:
        z
          .enum([
            'draft',
            'active',
            'retired',
          ])
          .optional(),

      page:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .default(
            1,
          ),

      limit:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(
            50,
          ),
    })
    .strict()

export const testFoodRuleSchema =
  z
    .object({
      ruleKey:
        z
          .string()
          .trim()
          .min(2)
          .max(120),

      evidenceComplete:
        z.boolean(),

      requiredFacts:
        z
          .array(
            z
              .object({
                factKey:
                  z
                    .string()
                    .trim()
                    .min(1),

                expectedValue:
                  z.union([
                    z.boolean(),
                    z.number(),
                    z.string(),
                  ]),
              })
              .strict(),
          ),

      factMap:
        z.record(
          z.string(),
          z.union([
            z.boolean(),
            z.number(),
            z.string(),
          ]),
        ),
    })
    .strict()

export const listFoodCalculationsQuerySchema =
  z
    .object({
      entityType:
        z
          .enum(
            FOOD_CALCULATION_ENTITY_TYPES,
          )
          .optional(),

      entityId:
        objectIdSchema
          .optional(),

      status:
        z
          .enum(
            FOOD_CALCULATION_STATUSES,
          )
          .optional(),

      page:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .default(
            1,
          ),

      limit:
        z
          .coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(
            50,
          ),
    })
    .strict()