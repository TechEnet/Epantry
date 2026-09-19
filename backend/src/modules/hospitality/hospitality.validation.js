import {
  z,
} from 'zod'

import {
  HOSPITALITY_PERMISSION_KEYS,
} from './hospitality.models.js'

const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    'A valid MongoDB ObjectId is required.',
  )

const recipeUnitSchema = z.enum([
  'mg',
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'clove',
  'bunch',
  'pinch',
])

const moneySchema = z
  .object({
    amountMinor:
      z
        .number()
        .int()
        .min(0),

    currency:
      z
        .string()
        .trim()
        .length(3)
        .toUpperCase()
        .default('INR'),
  })
  .strict()

export const hospitalityIdParamsSchema = z
  .object({
    id:
      objectIdSchema,
  })
  .strict()

export const initializeHospitalityProfileBodySchema = z
  .object({
    defaultCurrency:
      z
        .string()
        .trim()
        .length(3)
        .toUpperCase()
        .default('INR'),

    notes:
      z
        .string()
        .trim()
        .max(2000)
        .optional()
        .default(''),
  })
  .strict()

export const createOutletBodySchema = z
  .object({
    outletCode:
      z
        .string()
        .trim()
        .min(2)
        .max(40)
        .toUpperCase(),

    name:
      z
        .string()
        .trim()
        .min(2)
        .max(220),

    inheritanceMode:
      z
        .enum([
          'inherit_org_defaults',
          'custom',
        ])
        .default(
          'inherit_org_defaults',
        ),

    kitchenName:
      z
        .string()
        .trim()
        .max(220)
        .optional()
        .default(''),

    costCenterCode:
      z
        .string()
        .trim()
        .max(80)
        .toUpperCase()
        .optional()
        .default(''),

    timezone:
      z
        .string()
        .trim()
        .min(3)
        .max(80)
        .default(
          'Asia/Kolkata',
        ),

    address:
      z
        .object({
          line1:
            z
              .string()
              .trim()
              .max(300)
              .optional()
              .default(''),

          line2:
            z
              .string()
              .trim()
              .max(300)
              .optional()
              .default(''),

          city:
            z
              .string()
              .trim()
              .max(120)
              .optional()
              .default(''),

          state:
            z
              .string()
              .trim()
              .max(120)
              .optional()
              .default(''),

          postalCode:
            z
              .string()
              .trim()
              .max(20)
              .optional()
              .default(''),

          countryCode:
            z
              .string()
              .trim()
              .length(2)
              .toUpperCase()
              .default('IN'),
        })
        .strict()
        .default({}),
  })
  .strict()

export const updateOutletBodySchema =
  createOutletBodySchema
    .partial()
    .extend({
      status:
        z
          .enum([
            'active',
            'disabled',
          ])
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      'At least one outlet field must change.',
    )

export const upsertMemberGrantBodySchema = z
  .object({
    userId:
      objectIdSchema,

    permissionKeys:
      z
        .array(
          z.enum(
            HOSPITALITY_PERMISSION_KEYS,
          ),
        )
        .min(1)
        .max(
          HOSPITALITY_PERMISSION_KEYS.length,
        ),

    outletIds:
      z
        .array(
          objectIdSchema,
        )
        .max(100)
        .default([]),

    reason:
      z
        .string()
        .trim()
        .min(5)
        .max(1500),
  })
  .strict()

export const revokeMemberGrantBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(5)
        .max(1500),
  })
  .strict()

export const createSupplierBodySchema = z
  .object({
    supplierCode:
      z
        .string()
        .trim()
        .min(2)
        .max(60)
        .toUpperCase(),

    name:
      z
        .string()
        .trim()
        .min(2)
        .max(220),

    leadTimeDays:
      z
        .number()
        .int()
        .min(0)
        .max(365)
        .default(0),

    serviceOutletIds:
      z
        .array(
          objectIdSchema,
        )
        .max(100)
        .default([]),

    contact:
      z
        .object({
          name:
            z
              .string()
              .trim()
              .max(160)
              .optional()
              .default(''),

          email:
            z
              .union([
                z
                  .string()
                  .trim()
                  .email()
                  .max(254),

                z.literal(''),
              ])
              .optional()
              .default(''),

          phone:
            z
              .string()
              .trim()
              .max(40)
              .optional()
              .default(''),
        })
        .strict()
        .default({}),

    notes:
      z
        .string()
        .trim()
        .max(3000)
        .optional()
        .default(''),
  })
  .strict()

export const updateSupplierBodySchema =
  createSupplierBodySchema
    .partial()
    .extend({
      status:
        z
          .enum([
            'active',
            'disabled',
          ])
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      'At least one supplier field must change.',
    )

export const createSupplierProductBodySchema = z
  .object({
    supplierId:
      objectIdSchema,

    supplierSku:
      z
        .string()
        .trim()
        .min(1)
        .max(120),

    canonicalPackId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    canonicalIngredientId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    localDescription:
      z
        .string()
        .trim()
        .max(500)
        .optional()
        .default(''),

    packQuantity:
      z
        .number()
        .positive(),

    packUnit:
      recipeUnitSchema,

    contractCost:
      moneySchema,

    minimumOrderPacks:
      z
        .number()
        .int()
        .min(1)
        .default(1),

    leadTimeDays:
      z
        .number()
        .int()
        .min(0)
        .max(365)
        .default(0),

    effectiveFrom:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),

    effectiveTo:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      if (
        !value.canonicalPackId &&
        !value.canonicalIngredientId
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            'canonicalIngredientId',
          ],

          message:
            'Supplier Product must map to a canonical Pack or Ingredient.',
        })
      }

      if (
        value.effectiveFrom &&
        value.effectiveTo &&
        value.effectiveFrom >=
          value.effectiveTo
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

/*
|--------------------------------------------------------------------------
| Existing Supplier Product contract facts are not price-overwritten.
|--------------------------------------------------------------------------
|
| New contract cost / pack / MOQ / lead-time terms use POST and receive a new
| versionNumber.
|
| PATCH is lifecycle / descriptive only.
|--------------------------------------------------------------------------
*/

export const updateSupplierProductBodySchema = z
  .object({
    localDescription:
      z
        .string()
        .trim()
        .max(500)
        .optional(),

    status:
      z
        .enum([
          'active',
          'disabled',
          'expired',
        ])
        .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value).length >
      0,
    'At least one Supplier Product field must change.',
  )

const productionIngredientSchema = z
  .object({
    lineNumber:
      z
        .number()
        .int()
        .min(1),

    canonicalIngredientId:
      objectIdSchema,

    quantity:
      z
        .number()
        .positive(),

    unit:
      recipeUnitSchema,

    expectedWastePercentage:
      z
        .number()
        .min(0)
        .max(95)
        .default(0),

    preferredSupplierProductId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    optional:
      z
        .boolean()
        .default(false),

    notes:
      z
        .string()
        .trim()
        .max(1000)
        .optional()
        .default(''),
  })
  .strict()

export const createProductionRecipeBodySchema = z
  .object({
    recipeKey:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(120)
        .regex(
          /^[a-z0-9_-]+$/,
        ),

    dishId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    sourceRecipeVersionId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),

    title:
      z
        .string()
        .trim()
        .min(2)
        .max(220),

    baseYieldPortions:
      z
        .number()
        .int()
        .min(1)
        .max(100000),

    finishedYield:
      z
        .object({
          quantity:
            z
              .number()
              .positive(),

          unit:
            recipeUnitSchema,
        })
        .strict()
        .nullable()
        .optional()
        .default(null),

    productionUnit:
      z
        .string()
        .trim()
        .min(1)
        .max(120)
        .default(
          'portion',
        ),

    changeReason:
      z
        .string()
        .trim()
        .min(5)
        .max(1500),

    ingredients:
      z
        .array(
          productionIngredientSchema,
        )
        .min(1)
        .max(300),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      const lineNumbers =
        new Set()

      for (
        const ingredient of
        value.ingredients
      ) {
        if (
          lineNumbers.has(
            ingredient.lineNumber,
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'ingredients',
            ],

            message:
              'Production Recipe ingredient line numbers must be unique.',
          })

          break
        }

        lineNumbers.add(
          ingredient.lineNumber,
        )
      }
    },
  )

export const productionRecipeActionBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(5)
        .max(1500),
  })
  .strict()

export const createMenuBodySchema = z
  .object({
    outletId:
      objectIdSchema,

    menuCode:
      z
        .string()
        .trim()
        .min(2)
        .max(60)
        .toUpperCase(),

    name:
      z
        .string()
        .trim()
        .min(2)
        .max(220),

    effectiveFrom:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),

    effectiveTo:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),
  })
  .strict()

export const addMenuItemBodySchema = z
  .object({
    productionRecipeVersionId:
      objectIdSchema,

    displayName:
      z
        .string()
        .trim()
        .min(2)
        .max(220),

    sellingPrice:
      moneySchema
        .nullable()
        .optional()
        .default(null),
  })
  .strict()

export const calculateRecipeCostBodySchema = z
  .object({
    outletId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),
  })
  .strict()

export const createStockObservationBodySchema = z
  .object({
    outletId:
      objectIdSchema,

    canonicalIngredientId:
      objectIdSchema,

    quantity:
      z
        .number()
        .min(0),

    unit:
      recipeUnitSchema,

    source:
      z
        .enum([
          'manual_count',
          'import',
          'integration',
        ])
        .default(
          'manual_count',
        ),

    observedAt:
      z.coerce.date(),

    note:
      z
        .string()
        .trim()
        .max(1000)
        .optional()
        .default(''),
  })
  .strict()

export const createProductionPlanBodySchema = z
  .object({
    outletId:
      objectIdSchema,

    planDate:
      z.coerce.date(),

    items:
      z
        .array(
          z
            .object({
              productionRecipeVersionId:
                objectIdSchema,

              portions:
                z
                  .number()
                  .int()
                  .min(1)
                  .max(1000000),
            })
            .strict(),
        )
        .min(1)
        .max(200),
  })
  .strict()

export const createProcurementPlanBodySchema = z
  .object({
    productionPlanIds:
      z
        .array(
          objectIdSchema,
        )
        .min(1)
        .max(100),
  })
  .strict()